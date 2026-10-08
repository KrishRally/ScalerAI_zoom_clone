"""Shapes of the data the API accepts and returns (Pydantic models).

Keeping these separate from the database models means we control exactly
which fields go over the wire.
"""

from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    PlainSerializer,
    field_validator,
)

from app.models import MeetingStatus, MeetingType, ParticipantRole, ParticipantStatus


def _to_naive_utc(value: datetime) -> datetime:
    """Accept times with any timezone and store them as plain UTC."""
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _serialize_utc(value: datetime) -> str:
    # Add the "+00:00" so browsers know the time is UTC and convert it to local time.
    return value.replace(tzinfo=timezone.utc).isoformat()


# Use these instead of plain datetime in every schema.
UTCInput = Annotated[datetime, AfterValidator(_to_naive_utc)]
UTCOutput = Annotated[datetime, PlainSerializer(_serialize_utc, return_type=str)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Users ----------


class UserOut(ORMModel):
    id: int
    name: str
    email: str
    avatar_color: str
    personal_meeting_id: str


def _clean_name(value: str) -> str:
    value = " ".join(value.split())
    if not value:
        raise ValueError("Name cannot be empty")
    return value


class SignUp(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    # EmailStr checks it's a real looking address (name@domain.tld).
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        return _clean_name(value)


class SignIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AuthResult(BaseModel):
    token: str
    user: UserOut


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    avatar_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")

    @field_validator("name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        return None if value is None else _clean_name(value)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserSettingsOut(ORMModel):
    start_with_video: bool
    join_muted: bool
    show_preview: bool
    default_waiting_room: bool
    default_mute_on_entry: bool


class UserSettingsUpdate(BaseModel):
    start_with_video: bool | None = None
    join_muted: bool | None = None
    show_preview: bool | None = None
    default_waiting_room: bool | None = None
    default_mute_on_entry: bool | None = None


# ---------- Meetings ----------


class InstantMeetingCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class ScheduledMeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    scheduled_start: UTCInput
    duration_minutes: int = Field(default=60, ge=15, le=24 * 60)
    # Leave empty to have one generated.
    passcode: str | None = Field(default=None, max_length=10)
    # Options shown on Zoom's schedule form. Left out = use the user's defaults.
    waiting_room: bool | None = None
    mute_on_entry: bool | None = None

    @field_validator("title")
    @classmethod
    def _strip_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be empty")
        return value

    @field_validator("passcode")
    @classmethod
    def _check_passcode(cls, value: str | None) -> str | None:
        if value is None or value.strip() == "":
            return None
        value = value.strip()
        if not value.isalnum():
            raise ValueError("Passcode can only contain letters and numbers")
        return value


class MeetingUpdate(BaseModel):
    """All fields optional: only the ones sent are changed."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    scheduled_start: UTCInput | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=24 * 60)
    waiting_room: bool | None = None
    mute_on_entry: bool | None = None


class MeetingOut(ORMModel):
    id: int
    meeting_code: str
    title: str
    description: str | None
    host_id: int
    host_name: str
    meeting_type: MeetingType
    status: MeetingStatus
    passcode: str
    scheduled_start: UTCOutput | None
    duration_minutes: int
    started_at: UTCOutput | None
    ended_at: UTCOutput | None
    created_at: UTCOutput
    invite_link: str
    participant_count: int
    settings: "SettingsOut"


class MeetingLookup(BaseModel):
    """What a guest sees before joining. Leaves out the passcode."""

    meeting_code: str
    title: str
    host_id: int
    host_name: str
    status: MeetingStatus
    scheduled_start: UTCOutput | None
    requires_passcode: bool
    is_locked: bool


# ---------- Participants ----------


class JoinRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    passcode: str | None = None
    is_muted: bool = False
    is_video_on: bool = True
    # The browser's own random id (see Participant.client_id).
    client_id: str | None = Field(default=None, max_length=64)

    @field_validator("display_name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Display name cannot be empty")
        return value


class ParticipantOut(ORMModel):
    id: int
    meeting_id: int
    user_id: int | None
    display_name: str
    role: ParticipantRole
    status: ParticipantStatus
    is_muted: bool
    is_video_on: bool
    is_hand_raised: bool
    joined_at: UTCOutput
    left_at: UTCOutput | None


class JoinResult(ParticipantOut):
    """Returned once, when joining. The token proves who you are for every later action."""

    participant_token: str


class ParticipantUpdate(BaseModel):
    is_muted: bool | None = None
    is_video_on: bool | None = None
    is_hand_raised: bool | None = None
    display_name: str | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("display_name")
    @classmethod
    def _strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Display name cannot be empty")
        return value


class HostAction(BaseModel):
    """Host only actions say who is asking, so the server can check they are the host."""

    requester_id: int


class HostRename(HostAction):
    display_name: str = Field(min_length=1, max_length=100)

    @field_validator("display_name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Display name cannot be empty")
        return value


# ---------- Meeting settings ----------


class SettingsOut(ORMModel):
    allow_chat: bool
    allow_unmute: bool
    allow_video: bool
    allow_screen_share: bool
    allow_reactions: bool
    allow_rename: bool
    mute_on_entry: bool
    waiting_room: bool
    is_locked: bool


class SettingsUpdate(HostAction):
    """Only the fields sent are changed."""

    allow_chat: bool | None = None
    allow_unmute: bool | None = None
    allow_video: bool | None = None
    allow_screen_share: bool | None = None
    allow_reactions: bool | None = None
    allow_rename: bool | None = None
    mute_on_entry: bool | None = None
    waiting_room: bool | None = None
    is_locked: bool | None = None


# ---------- Notes ----------


class NoteSave(BaseModel):
    participant_id: int
    content: str = Field(max_length=20000)


class NoteOut(BaseModel):
    content: str
    updated_at: UTCOutput | None


# ---------- Reactions ----------


class ReactionCreate(BaseModel):
    participant_id: int
    emoji: str = Field(min_length=1, max_length=16)


class ReactionOut(BaseModel):
    id: int
    participant_id: int
    emoji: str


# ---------- Chat ----------


class ChatMessageCreate(BaseModel):
    participant_id: int
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def _strip_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message cannot be empty")
        return value


class ChatMessageOut(BaseModel):
    id: int
    participant_id: int
    sender_name: str
    content: str
    sent_at: UTCOutput


# ---------- Live room state ----------


class RoomState(BaseModel):
    """Everything the meeting room needs, returned by one polling call."""

    meeting: MeetingOut
    me: ParticipantOut
    participants: list[ParticipantOut]
    # People in the waiting room (only filled in for the host).
    waiting: list[ParticipantOut]
    messages: list[ChatMessageOut]
    # Reactions from the last few seconds.
    reactions: list[ReactionOut]


MeetingOut.model_rebuild()


# ---------- People (for Team Chat and sharing) ----------


class PersonOut(ORMModel):
    id: int
    name: str
    email: str
    avatar_color: str


# ---------- Team Chat ----------


class ChannelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    member_ids: list[int] = Field(default_factory=list, max_length=200)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        value = " ".join(value.split()).lstrip("#")
        if not value:
            raise ValueError("Channel name cannot be empty")
        return value


class DirectMessageCreate(BaseModel):
    user_id: int


class ChannelMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)

    @field_validator("content")
    @classmethod
    def _content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message cannot be empty")
        return value


class ChannelMessageOut(BaseModel):
    id: int
    channel_id: int
    sender: PersonOut
    content: str
    created_at: UTCOutput


class ChannelOut(BaseModel):
    id: int
    # For direct messages this is the other person's name.
    name: str
    is_direct: bool
    is_default: bool
    members: list[PersonOut]
    unread_count: int
    last_message: ChannelMessageOut | None


class UnreadOut(BaseModel):
    unread: int


# ---------- Notifications ----------


class NotificationOut(BaseModel):
    id: str  # stable, e.g. "chat-3" or "doc-7"
    kind: Literal["chat", "doc", "meeting"]
    title: str
    body: str
    created_at: UTCOutput
    link: str
    unseen: bool
    actor: PersonOut | None = None
    meeting_code: str | None = None


class NotificationsOut(BaseModel):
    items: list[NotificationOut]
    unseen: int


# ---------- Docs ----------


class DocumentCreate(BaseModel):
    title: str = Field(default="Untitled", max_length=200)
    content: str = Field(default="", max_length=200_000)


class DocumentUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    content: str | None = Field(default=None, max_length=200_000)


class DocumentMemberOut(BaseModel):
    user: PersonOut
    can_edit: bool


class DocumentSummary(BaseModel):
    id: int
    title: str
    snippet: str
    owner: PersonOut
    is_owner: bool
    can_edit: bool
    shared: bool
    updated_at: UTCOutput
    updated_by_name: str | None


class DocumentOut(DocumentSummary):
    content: str
    members: list[DocumentMemberOut]


class DocumentShare(BaseModel):
    email: EmailStr
    can_edit: bool = True
