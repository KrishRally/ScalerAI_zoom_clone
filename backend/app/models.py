"""Database tables.

    users ──< meetings (as host)
    meetings ──< participants >── users (optional: guests have no user)
    meetings ──< chat_messages >── participants
    meetings ──1 meeting_settings      (host rules for the meeting)
    meetings ──< meeting_notes         (private notes, one per person per meeting)
    meetings ──< reactions >── participants
    users ──< auth_sessions            (one row per signed in browser)
    users ──1 user_settings            (personal defaults)

Team Chat:
    chat_channels ──< channel_members >── users
    chat_channels ──< channel_messages >── users

Docs:
    users ──< documents ──< document_members >── users

All times are stored in UTC.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    # Stored without tzinfo; SQLite has no timezone type, and we keep everything in UTC.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class MeetingType(str, enum.Enum):
    instant = "instant"
    scheduled = "scheduled"


class MeetingStatus(str, enum.Enum):
    scheduled = "scheduled"  # created, nobody has joined yet
    live = "live"  # at least one person is in it
    ended = "ended"  # host ended it, or everyone left


class ParticipantRole(str, enum.Enum):
    host = "host"
    attendee = "attendee"


class ParticipantStatus(str, enum.Enum):
    waiting = "waiting"  # in the waiting room, not let in yet
    in_meeting = "in_meeting"
    left = "left"
    removed = "removed"  # removed by the host


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    avatar_color: Mapped[str] = mapped_column(String(7), default="#0E71EB")
    # Every Zoom user has a fixed Personal Meeting ID (PMI).
    personal_meeting_id: Mapped[str] = mapped_column(String(11), unique=True)
    # Salted PBKDF2 hash, never the password itself. See services/security.py.
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    # When the user last opened the notifications bell. Newer items count as unseen.
    notifications_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    hosted_meetings: Mapped[list["Meeting"]] = relationship(back_populates="host")
    settings: Mapped["UserSettings | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # The public 10 or 11 digit Meeting ID people type in to join.
    meeting_code: Mapped[str] = mapped_column(String(11), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    meeting_type: Mapped[MeetingType] = mapped_column(Enum(MeetingType))
    status: Mapped[MeetingStatus] = mapped_column(
        Enum(MeetingStatus), default=MeetingStatus.scheduled
    )
    passcode: Mapped[str] = mapped_column(String(10))
    # Only set for scheduled meetings.
    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    # Real start and end times, filled in when people actually join and leave.
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    host: Mapped[User] = relationship(back_populates="hosted_meetings")
    participants: Mapped[list["Participant"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan"
    )
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan"
    )
    settings: Mapped["MeetingSettings | None"] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", uselist=False
    )

    __table_args__ = (
        # Speeds up the dashboard queries for upcoming and recent meetings.
        Index("ix_meetings_host_status_start", "host_id", "status", "scheduled_start"),
        Index("ix_meetings_started_at", "started_at"),
    )


class Participant(Base):
    """One row per time someone joins a meeting."""

    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    # Empty for guests who join with only a display name.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    display_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[ParticipantRole] = mapped_column(
        Enum(ParticipantRole), default=ParticipantRole.attendee
    )
    status: Mapped[ParticipantStatus] = mapped_column(
        Enum(ParticipantStatus), default=ParticipantStatus.in_meeting
    )
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_video_on: Mapped[bool] = mapped_column(Boolean, default=True)
    is_hand_raised: Mapped[bool] = mapped_column(Boolean, default=False)
    # True while this person shares their screen (the picture itself goes over WebRTC).
    is_sharing_screen: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    # A random id each browser tab keeps, so rejoining from the same tab
    # replaces the old entry instead of showing the person twice.
    client_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # Hash of the secret key given to this participant when they joined.
    # Every action they take in the room must come with that key.
    token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    left_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Updated every time the participant's browser checks in.
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    meeting: Mapped[Meeting] = relationship(back_populates="participants")
    user: Mapped[User | None] = relationship()

    __table_args__ = (Index("ix_participants_meeting_status", "meeting_id", "status"),)


class Signal(Base):
    """A WebRTC connection note passed from one participant's browser to another's.

    Browsers can't find each other on their own, so they leave an "offer" or
    "answer" (which says how to reach them and what media they send) here, and
    the other side picks it up on its next check. Once delivered, it is deleted.
    The audio and video themselves go straight between the browsers.
    """

    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    from_participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id", ondelete="CASCADE"))
    to_participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id", ondelete="CASCADE"))
    payload: Mapped[str] = mapped_column(Text)  # JSON, opaque to the server
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    __table_args__ = (Index("ix_signals_to_id", "to_participant_id", "id"),)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    participant_id: Mapped[int] = mapped_column(
        ForeignKey("participants.id", ondelete="CASCADE")
    )
    content: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    meeting: Mapped[Meeting] = relationship(back_populates="messages")
    participant: Mapped[Participant] = relationship()

    __table_args__ = (Index("ix_chat_meeting_id", "meeting_id", "id"),)


class MeetingSettings(Base):
    """Rules the host controls. One row per meeting.

    Kept in its own table (not extra columns on meetings) so settings can grow
    without touching the meetings table, and so existing databases pick it up
    automatically on startup.
    """

    __tablename__ = "meeting_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), unique=True
    )
    # What attendees are allowed to do (the host can always do everything).
    allow_chat: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_unmute: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_video: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_screen_share: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_reactions: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_rename: Mapped[bool] = mapped_column(Boolean, default=True)
    # Meeting level switches.
    mute_on_entry: Mapped[bool] = mapped_column(Boolean, default=False)
    waiting_room: Mapped[bool] = mapped_column(Boolean, default=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    meeting: Mapped[Meeting] = relationship(back_populates="settings")


class MeetingNote(Base):
    """Private notes, like Zoom's "My Notes".

    The signed in user's notes are keyed by user_id, so they are the same note
    even if they leave and rejoin. Guests have no user, so theirs are keyed by
    their participant row.
    """

    __tablename__ = "meeting_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    participant_id: Mapped[int | None] = mapped_column(
        ForeignKey("participants.id", ondelete="CASCADE"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        # NULLs don't clash in a unique index, so each rule applies only to its own kind of note.
        Index("ux_notes_meeting_user", "meeting_id", "user_id", unique=True),
        Index("ux_notes_meeting_participant", "meeting_id", "participant_id", unique=True),
    )


class Reaction(Base):
    """An emoji reaction. Short lived: the room only shows the last few seconds."""

    __tablename__ = "reactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    participant_id: Mapped[int] = mapped_column(
        ForeignKey("participants.id", ondelete="CASCADE")
    )
    emoji: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    __table_args__ = (Index("ix_reactions_meeting_created", "meeting_id", "created_at"),)


class AuthSession(Base):
    """A signed in browser. Signing out deletes the row, so the token stops working."""

    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # Only a hash of the token is stored, so a leaked database can't be used to sign in.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    user: Mapped[User] = relationship()


class UserSettings(Base):
    """Personal defaults from the Settings page. One row per user."""

    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    start_with_video: Mapped[bool] = mapped_column(Boolean, default=True)
    join_muted: Mapped[bool] = mapped_column(Boolean, default=False)
    show_preview: Mapped[bool] = mapped_column(Boolean, default=True)
    # Used for new meetings this user creates.
    default_waiting_room: Mapped[bool] = mapped_column(Boolean, default=False)
    default_mute_on_entry: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="settings")


# ---------------------------------------------------------------- Team Chat


class ChatChannel(Base):
    """A Team Chat conversation: a named channel, or a direct message between people."""

    __tablename__ = "chat_channels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Empty for direct messages; their name is the other person's name.
    name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    is_direct: Mapped[bool] = mapped_column(Boolean, default=False)
    # The "General" channel every user is added to.
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    members: Mapped[list["ChannelMember"]] = relationship(
        back_populates="channel", cascade="all, delete-orphan"
    )


class ChannelMember(Base):
    """Who is in a channel, and how far they have read (for unread counts)."""

    __tablename__ = "channel_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    channel_id: Mapped[int] = mapped_column(ForeignKey("chat_channels.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # Messages with a higher id than this are unread.
    last_read_message_id: Mapped[int] = mapped_column(Integer, default=0)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    channel: Mapped[ChatChannel] = relationship(back_populates="members")
    user: Mapped[User] = relationship()

    __table_args__ = (Index("ux_channel_member", "channel_id", "user_id", unique=True),)


class ChannelMessage(Base):
    __tablename__ = "channel_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    channel_id: Mapped[int] = mapped_column(ForeignKey("chat_channels.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped[User] = relationship()

    __table_args__ = (Index("ix_channel_messages_channel_id", "channel_id", "id"),)


# ---------------------------------------------------------------- Docs


class Document(Base):
    """A Zoom Docs style document."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200), default="Untitled")
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    owner: Mapped[User] = relationship(foreign_keys=[owner_id])
    editor: Mapped[User | None] = relationship(foreign_keys=[updated_by])
    members: Mapped[list["DocumentMember"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class DocumentMember(Base):
    """Someone a document is shared with. The owner is not listed here."""

    __tablename__ = "document_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    can_edit: Mapped[bool] = mapped_column(Boolean, default=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    document: Mapped[Document] = relationship(back_populates="members")
    user: Mapped[User] = relationship()

    __table_args__ = (Index("ux_document_member", "document_id", "user_id", unique=True),)
