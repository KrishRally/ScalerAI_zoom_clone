"""Participants: joining, the waiting room, leaving, checking in, changing yourself,
and the live room state each browser polls."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.config import PARTICIPANT_TIMEOUT_SECONDS
from app.models import (
    Meeting,
    MeetingStatus,
    Participant,
    ParticipantRole,
    ParticipantStatus,
    User,
    utcnow,
)
from app.services.errors import BadRequest, Forbidden, NotFound
from app.services.meeting_chat import list_messages, recent_reactions, to_message_out
from app.services.meetings import get_settings, to_meeting_out
from app.services.security import hash_token, new_token


def get_participant(db: Session, participant_id: int) -> Participant:
    participant = db.get(Participant, participant_id)
    if participant is None:
        raise NotFound("Participant not found")
    return participant


def authenticate(db: Session, participant_id: int, token: str | None) -> Participant:
    """Check the secret key sent with a request belongs to this participant.

    Participant ids are just numbers anyone could guess, so every action in a
    room (including host controls) must also carry the key given at join time.
    """
    participant = get_participant(db, participant_id)
    if not token or not participant.token_hash or participant.token_hash != hash_token(token):
        raise Forbidden("You are not allowed to act as this participant")
    return participant


def _participants_with_status(
    db: Session, meeting: Meeting, status: ParticipantStatus
) -> list[Participant]:
    return list(
        db.scalars(
            select(Participant)
            .where(Participant.meeting_id == meeting.id, Participant.status == status)
            .order_by(Participant.joined_at)
        ).all()
    )


def active_participants(db: Session, meeting: Meeting) -> list[Participant]:
    return _participants_with_status(db, meeting, ParticipantStatus.in_meeting)


def waiting_participants(db: Session, meeting: Meeting) -> list[Participant]:
    return _participants_with_status(db, meeting, ParticipantStatus.waiting)


def _ensure_host(db: Session, meeting: Meeting) -> None:
    """If the host is gone but others are still here, the person who joined first becomes host.

    This is what Zoom does when the host drops without handing over.
    """
    people = active_participants(db, meeting)
    if people and not any(p.role == ParticipantRole.host for p in people):
        people[0].role = ParticipantRole.host


def _close_if_empty(db: Session, meeting: Meeting) -> None:
    """When the last person leaves, the meeting is over."""
    if meeting.status == MeetingStatus.live and not active_participants(db, meeting):
        meeting.status = MeetingStatus.ended
        meeting.ended_at = utcnow()


def _after_someone_left(db: Session, meeting: Meeting) -> None:
    db.flush()
    _ensure_host(db, meeting)
    _close_if_empty(db, meeting)


# ---------- Joining ----------


def join_meeting(
    db: Session, meeting: Meeting, data: schemas.JoinRequest, user: User | None
) -> schemas.JoinResult:
    """Join a meeting. `user` is the signed in account, or None for guests.

    Only the meeting's owner, proven by their sign in, becomes host.
    """
    is_owner = user is not None and user.id == meeting.host_id
    settings = get_settings(db, meeting)

    if meeting.status == MeetingStatus.ended and not is_owner:
        raise BadRequest("This meeting has ended")
    # The host already has the passcode, and the dashboard joins without one.
    if not is_owner and (data.passcode or "").strip() != meeting.passcode:
        raise Forbidden("Incorrect meeting passcode")
    if settings.is_locked and not is_owner:
        raise Forbidden("This meeting has been locked by the host")

    now = utcnow()

    # Rejoining from the same browser (after pressing Back, refreshing or a crash)
    # replaces the old entry, so the person isn't shown twice.
    was_host, was_admitted = _replace_previous_entries(db, meeting, data.client_id, now)

    goes_to_waiting_room = settings.waiting_room and not is_owner and not was_admitted

    if is_owner:
        # The meeting's owner always gets host back when they (re)join.
        for p in active_participants(db, meeting):
            if p.role == ParticipantRole.host:
                p.role = ParticipantRole.attendee

    if not goes_to_waiting_room and meeting.status != MeetingStatus.live:
        # First person in (or the host restarting an ended meeting) opens the meeting.
        meeting.status = MeetingStatus.live
        meeting.started_at = now
        meeting.ended_at = None

    # The host's rules can override what the person picked on the preview screen.
    is_muted = data.is_muted
    is_video_on = data.is_video_on
    if not is_owner:
        if settings.mute_on_entry or not settings.allow_unmute:
            is_muted = True
        if not settings.allow_video:
            is_video_on = False

    token, token_hash = new_token()
    participant = Participant(
        meeting_id=meeting.id,
        user_id=user.id if user else None,
        token_hash=token_hash,
        display_name=data.display_name,
        role=ParticipantRole.host if (is_owner or was_host) else ParticipantRole.attendee,
        status=ParticipantStatus.waiting if goes_to_waiting_room else ParticipantStatus.in_meeting,
        client_id=data.client_id,
        is_muted=is_muted,
        is_video_on=is_video_on,
        joined_at=now,
        last_seen_at=now,
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return schemas.JoinResult(
        **schemas.ParticipantOut.model_validate(participant).model_dump(),
        participant_token=token,
    )


def _replace_previous_entries(
    db: Session, meeting: Meeting, client_id: str | None, now
) -> tuple[bool, bool]:
    """Mark this browser's earlier entries in the meeting as left.

    Returns (was_host, was_admitted) so the new entry can keep the host role
    and skip the waiting room if they had already been let in.
    """
    if not client_id:
        return False, False
    previous = list(
        db.scalars(
            select(Participant).where(
                Participant.meeting_id == meeting.id,
                Participant.client_id == client_id,
                Participant.status.in_([ParticipantStatus.in_meeting, ParticipantStatus.waiting]),
            )
        ).all()
    )
    was_host = any(p.role == ParticipantRole.host for p in previous)
    was_admitted = any(p.status == ParticipantStatus.in_meeting for p in previous)
    for p in previous:
        p.status = ParticipantStatus.left
        p.left_at = now
    return was_host, was_admitted


def leave_meeting(db: Session, participant: Participant) -> None:
    if participant.status in (ParticipantStatus.in_meeting, ParticipantStatus.waiting):
        participant.status = ParticipantStatus.left
        participant.left_at = utcnow()
        _after_someone_left(db, participant.meeting)
    db.commit()


def expire_stale_participants(db: Session, meeting: Meeting) -> None:
    """Mark people as left if their browser stopped checking in (tab closed, lost network)."""
    cutoff = utcnow() - timedelta(seconds=PARTICIPANT_TIMEOUT_SECONDS)
    changed = False
    for p in active_participants(db, meeting) + waiting_participants(db, meeting):
        if p.last_seen_at < cutoff:
            p.status = ParticipantStatus.left
            p.left_at = utcnow()
            changed = True
    if changed:
        _after_someone_left(db, meeting)
        db.commit()


def expire_stale_everywhere(db: Session) -> None:
    """Run the same clean up for every live meeting.

    Called when the dashboard loads, so a meeting everyone left by closing
    their tab still moves from "live" to "ended".
    """
    live = db.scalars(select(Meeting).where(Meeting.status == MeetingStatus.live)).all()
    for meeting in live:
        expire_stale_participants(db, meeting)


# ---------- Changing yourself ----------


def update_participant(
    db: Session, participant: Participant, data: schemas.ParticipantUpdate
) -> Participant:
    """A participant changing their own mic, camera, raised hand or name."""
    if participant.status != ParticipantStatus.in_meeting:
        raise BadRequest("You are no longer in this meeting")
    changes = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}

    if participant.role != ParticipantRole.host:
        settings = get_settings(db, participant.meeting)
        # Only block turning things ON. Turning them off is always allowed.
        if changes.get("is_muted") is False and participant.is_muted and not settings.allow_unmute:
            raise Forbidden("The host has disabled unmuting")
        if changes.get("is_video_on") is True and not participant.is_video_on and not settings.allow_video:
            raise Forbidden("The host has disabled starting video")
        if "display_name" in changes and not settings.allow_rename:
            raise Forbidden("The host has disabled renaming")
        if changes.get("is_sharing_screen") is True and not settings.allow_screen_share:
            raise Forbidden("The host has disabled screen sharing")

    # One person shares at a time, like Zoom: starting a share stops anyone else's.
    if changes.get("is_sharing_screen") is True:
        for other in active_participants(db, participant.meeting):
            if other.id != participant.id and other.is_sharing_screen:
                other.is_sharing_screen = False
                other.share_with_video = False

    for field, value in changes.items():
        setattr(participant, field, value)
    db.commit()
    db.refresh(participant)
    return participant




# ---------- Live room state ----------


def room_state(
    db: Session, meeting: Meeting, participant: Participant, after_message_id: int
) -> schemas.RoomState:
    """One call the meeting room makes every couple of seconds.

    It also counts as a check in, so we know this person is still here.
    """
    if participant.meeting_id != meeting.id:
        raise BadRequest("Participant does not belong to this meeting")
    if participant.status in (ParticipantStatus.in_meeting, ParticipantStatus.waiting):
        participant.last_seen_at = utcnow()
        db.commit()
    expire_stale_participants(db, meeting)
    db.refresh(meeting)
    db.refresh(participant)

    in_meeting = participant.status == ParticipantStatus.in_meeting
    is_host = in_meeting and participant.role == ParticipantRole.host
    # People still in the waiting room only learn whether they've been let in.
    return schemas.RoomState(
        meeting=to_meeting_out(db, meeting),
        me=schemas.ParticipantOut.model_validate(participant),
        participants=[
            schemas.ParticipantOut.model_validate(p) for p in active_participants(db, meeting)
        ]
        if in_meeting
        else [],
        waiting=[
            schemas.ParticipantOut.model_validate(p) for p in waiting_participants(db, meeting)
        ]
        if is_host
        else [],
        messages=[to_message_out(m) for m in list_messages(db, meeting, after_message_id)]
        if in_meeting
        else [],
        reactions=[
            schemas.ReactionOut(id=r.id, participant_id=r.participant_id, emoji=r.emoji)
            for r in recent_reactions(db, meeting)
        ]
        if in_meeting
        else [],
    )
