"""Database tables.

    users ──< meetings (as host)
    meetings ──< participants >── users (optional: guests have no user)
    meetings ──< chat_messages >── participants
    meetings ──1 meeting_settings      (host rules for the meeting)
    meetings ──< meeting_notes         (private notes, one per person per meeting)
    meetings ──< reactions >── participants
    users ──< auth_sessions            (one row per signed in browser)
    users ──1 user_settings            (personal defaults)

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
