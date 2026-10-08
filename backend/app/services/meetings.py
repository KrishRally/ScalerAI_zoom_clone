"""Meeting rules: create, schedule, list, edit, end."""

from datetime import timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app import schemas
from app.models import (
    Meeting,
    MeetingSettings,
    MeetingStatus,
    MeetingType,
    Participant,
    ParticipantStatus,
    User,
    utcnow,
)
from app.services.codes import (
    build_invite_link,
    generate_meeting_code,
    generate_passcode,
    normalize_meeting_code,
)
from app.services.auth import get_user_settings
from app.services.errors import BadRequest, Forbidden, NotFound


def _settings_from_defaults(
    db: Session, host: User, waiting_room: bool | None = None, mute_on_entry: bool | None = None
) -> MeetingSettings:
    """New meetings start from the host's defaults on the Settings page."""
    defaults = get_user_settings(db, host)
    return MeetingSettings(
        waiting_room=defaults.default_waiting_room if waiting_room is None else waiting_room,
        mute_on_entry=defaults.default_mute_on_entry if mute_on_entry is None else mute_on_entry,
    )


def get_settings(db: Session, meeting: Meeting) -> MeetingSettings:
    """The meeting's settings row, created with defaults the first time it's needed.

    Creating it lazily means meetings made before settings existed still work.
    """
    if meeting.settings is None:
        meeting.settings = MeetingSettings()
        db.commit()
        db.refresh(meeting)
    return meeting.settings


def to_meeting_out(db: Session, meeting: Meeting) -> schemas.MeetingOut:
    active = db.scalar(
        select(func.count(Participant.id)).where(
            Participant.meeting_id == meeting.id,
            Participant.status == ParticipantStatus.in_meeting,
        )
    )
    return schemas.MeetingOut(
        id=meeting.id,
        meeting_code=meeting.meeting_code,
        title=meeting.title,
        description=meeting.description,
        host_id=meeting.host_id,
        host_name=meeting.host.name,
        meeting_type=meeting.meeting_type,
        status=meeting.status,
        passcode=meeting.passcode,
        scheduled_start=meeting.scheduled_start,
        duration_minutes=meeting.duration_minutes,
        started_at=meeting.started_at,
        ended_at=meeting.ended_at,
        created_at=meeting.created_at,
        invite_link=build_invite_link(meeting.meeting_code, meeting.passcode),
        participant_count=active or 0,
        settings=schemas.SettingsOut.model_validate(get_settings(db, meeting)),
    )


def get_meeting(db: Session, raw_code: str) -> Meeting:
    """Find a meeting by Meeting ID or invite link, or raise NotFound."""
    code = normalize_meeting_code(raw_code)
    if not code:
        raise BadRequest("Please enter a valid Meeting ID or invite link")
    meeting = db.scalar(select(Meeting).where(Meeting.meeting_code == code))
    if meeting is None:
        raise NotFound("This meeting ID is not valid. Please check and try again.")
    return meeting


def create_instant_meeting(
    db: Session, host: User, data: schemas.InstantMeetingCreate
) -> Meeting:
    meeting = Meeting(
        meeting_code=generate_meeting_code(db),
        title=data.title or f"{host.name}'s Zoom Meeting",
        host_id=host.id,
        meeting_type=MeetingType.instant,
        status=MeetingStatus.scheduled,  # becomes "live" when the host joins
        passcode=generate_passcode(),
        duration_minutes=60,
        settings=_settings_from_defaults(db, host),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def create_scheduled_meeting(
    db: Session, host: User, data: schemas.ScheduledMeetingCreate
) -> Meeting:
    # Allow a few minutes of slack so "starting now" still works.
    if data.scheduled_start < utcnow() - timedelta(minutes=5):
        raise BadRequest("The meeting start time must be in the future")
    meeting = Meeting(
        meeting_code=generate_meeting_code(db),
        title=data.title,
        description=data.description,
        host_id=host.id,
        meeting_type=MeetingType.scheduled,
        status=MeetingStatus.scheduled,
        passcode=data.passcode or generate_passcode(),
        scheduled_start=data.scheduled_start,
        duration_minutes=data.duration_minutes,
        settings=_settings_from_defaults(db, host, data.waiting_room, data.mute_on_entry),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def list_upcoming(db: Session, user: User) -> list[Meeting]:
    """Scheduled meetings that have not ended and whose time window has not passed."""
    now = utcnow()
    meetings = db.scalars(
        select(Meeting)
        .where(
            Meeting.host_id == user.id,
            Meeting.meeting_type == MeetingType.scheduled,
            Meeting.status != MeetingStatus.ended,
            Meeting.scheduled_start.is_not(None),
        )
        .order_by(Meeting.scheduled_start)
    ).all()
    # The end time depends on each meeting's duration, so we filter in Python.
    return [
        m
        for m in meetings
        if m.scheduled_start + timedelta(minutes=m.duration_minutes) > now
        or m.status == MeetingStatus.live
    ]


def list_recent(db: Session, user: User, limit: int = 20) -> list[Meeting]:
    """Meetings the user hosted or joined that have actually started, newest first."""
    joined_ids = select(Participant.meeting_id).where(Participant.user_id == user.id)
    return list(
        db.scalars(
            select(Meeting)
            .where(
                or_(Meeting.host_id == user.id, Meeting.id.in_(joined_ids)),
                Meeting.started_at.is_not(None),
            )
            .order_by(Meeting.started_at.desc())
            .limit(limit)
        ).all()
    )


def update_meeting(
    db: Session, user: User, meeting: Meeting, data: schemas.MeetingUpdate
) -> Meeting:
    if meeting.host_id != user.id:
        raise Forbidden("Only the host can edit this meeting")
    if meeting.status == MeetingStatus.ended:
        raise BadRequest("This meeting has already ended")
    changes = data.model_dump(exclude_unset=True)
    settings_fields = {"waiting_room", "mute_on_entry"}
    settings = get_settings(db, meeting)
    for field, value in changes.items():
        if value is None:
            continue
        setattr(settings if field in settings_fields else meeting, field, value)
    db.commit()
    db.refresh(meeting)
    return meeting


def delete_meeting(db: Session, user: User, meeting: Meeting) -> None:
    if meeting.host_id != user.id:
        raise Forbidden("Only the host can delete this meeting")
    db.delete(meeting)
    db.commit()


def end_meeting(db: Session, meeting: Meeting) -> Meeting:
    """Mark the meeting ended and everyone still in it as left."""
    now = utcnow()
    for p in meeting.participants:
        if p.status == ParticipantStatus.in_meeting:
            p.status = ParticipantStatus.left
            p.left_at = now
    meeting.status = MeetingStatus.ended
    meeting.ended_at = now
    db.commit()
    db.refresh(meeting)
    return meeting
