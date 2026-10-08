"""Host controls: mute, remove, admit, rename, make host, meeting settings,
suspend activities and end the meeting for everyone."""

from sqlalchemy.orm import Session

from app import schemas
from app.models import (
    Meeting,
    Participant,
    ParticipantRole,
    ParticipantStatus,
    utcnow,
)
from app.services.errors import BadRequest, Forbidden
from app.services.meetings import end_meeting, get_settings
from app.services.participants import active_participants, waiting_participants


# ---------- Host controls ----------


def _require_host(db: Session, meeting: Meeting, requester_id: int) -> Participant:
    requester = db.get(Participant, requester_id)
    if (
        requester is None
        or requester.meeting_id != meeting.id
        or requester.role != ParticipantRole.host
        or requester.status != ParticipantStatus.in_meeting
    ):
        raise Forbidden("Only the host can do this")
    return requester


def mute_all(db: Session, meeting: Meeting, requester_id: int) -> int:
    """Mute everyone except the host. Returns how many people were muted."""
    host = _require_host(db, meeting, requester_id)
    count = 0
    for p in active_participants(db, meeting):
        if p.id != host.id and not p.is_muted:
            p.is_muted = True
            count += 1
    db.commit()
    return count


def host_mute(db: Session, target: Participant, requester_id: int) -> Participant:
    _require_host(db, target.meeting, requester_id)
    target.is_muted = True
    db.commit()
    db.refresh(target)
    return target


def remove_participant(db: Session, target: Participant, requester_id: int) -> None:
    """Remove someone from the meeting or the waiting room."""
    host = _require_host(db, target.meeting, requester_id)
    if target.id == host.id:
        raise BadRequest("The host cannot remove themselves")
    if target.status in (ParticipantStatus.in_meeting, ParticipantStatus.waiting):
        target.status = ParticipantStatus.removed
        target.left_at = utcnow()
    db.commit()


def _admit(target: Participant) -> None:
    now = utcnow()
    target.status = ParticipantStatus.in_meeting
    target.joined_at = now
    target.last_seen_at = now


def admit(db: Session, target: Participant, requester_id: int) -> Participant:
    _require_host(db, target.meeting, requester_id)
    if target.status != ParticipantStatus.waiting:
        raise BadRequest("This person is not in the waiting room")
    _admit(target)
    db.commit()
    db.refresh(target)
    return target


def admit_all(db: Session, meeting: Meeting, requester_id: int) -> int:
    _require_host(db, meeting, requester_id)
    waiting = waiting_participants(db, meeting)
    for p in waiting:
        _admit(p)
    db.commit()
    return len(waiting)


def host_rename(db: Session, target: Participant, requester_id: int, name: str) -> Participant:
    _require_host(db, target.meeting, requester_id)
    target.display_name = name
    db.commit()
    db.refresh(target)
    return target


def make_host(db: Session, target: Participant, requester_id: int) -> Participant:
    """Hand the host role to someone else. The old host becomes an attendee."""
    host = _require_host(db, target.meeting, requester_id)
    if target.id == host.id:
        raise BadRequest("You are already the host")
    if target.status != ParticipantStatus.in_meeting:
        raise BadRequest("This person is not in the meeting")
    host.role = ParticipantRole.attendee
    target.role = ParticipantRole.host
    db.commit()
    db.refresh(target)
    return target


def update_settings(
    db: Session, meeting: Meeting, data: schemas.SettingsUpdate
) -> schemas.SettingsOut:
    _require_host(db, meeting, data.requester_id)
    settings = get_settings(db, meeting)
    changes = data.model_dump(exclude_unset=True, exclude={"requester_id"})
    for field, value in changes.items():
        if value is not None:
            setattr(settings, field, value)
    # Turning screen sharing off stops everyone but the host who is sharing.
    if changes.get("allow_screen_share") is False:
        _stop_attendee_sharing(db, meeting)
    # Turning the waiting room off lets everyone who was waiting in, like Zoom.
    if changes.get("waiting_room") is False:
        for p in waiting_participants(db, meeting):
            _admit(p)
    db.commit()
    return schemas.SettingsOut.model_validate(settings)


def _stop_attendee_sharing(db: Session, meeting: Meeting) -> None:
    for p in active_participants(db, meeting):
        if p.role != ParticipantRole.host:
            p.is_sharing_screen = False
            p.share_with_video = False


def suspend_activities(db: Session, meeting: Meeting, requester_id: int) -> schemas.SettingsOut:
    """Zoom's emergency button: stop everyone's audio, video and chat and lock the meeting."""
    host = _require_host(db, meeting, requester_id)
    settings = get_settings(db, meeting)
    for field in (
        "allow_chat",
        "allow_unmute",
        "allow_video",
        "allow_screen_share",
        "allow_reactions",
        "allow_rename",
    ):
        setattr(settings, field, False)
    settings.is_locked = True
    for p in active_participants(db, meeting):
        if p.id != host.id:
            p.is_muted = True
            p.is_video_on = False
            p.is_sharing_screen = False
            p.share_with_video = False
    db.commit()
    return schemas.SettingsOut.model_validate(settings)


def end_for_all(db: Session, meeting: Meeting, requester_id: int) -> Meeting:
    _require_host(db, meeting, requester_id)
    for p in waiting_participants(db, meeting):
        p.status = ParticipantStatus.left
        p.left_at = utcnow()
    return end_meeting(db, meeting)
