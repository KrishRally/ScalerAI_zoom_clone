"""Participant rules: join, leave, check in, host controls, chat."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.config import PARTICIPANT_TIMEOUT_SECONDS
from app.models import (
    ChatMessage,
    Meeting,
    MeetingStatus,
    Participant,
    ParticipantRole,
    ParticipantStatus,
    utcnow,
)
from app.services.errors import BadRequest, Forbidden, NotFound
from app.services.meetings import end_meeting, to_meeting_out


def get_participant(db: Session, participant_id: int) -> Participant:
    participant = db.get(Participant, participant_id)
    if participant is None:
        raise NotFound("Participant not found")
    return participant


def active_participants(db: Session, meeting: Meeting) -> list[Participant]:
    return list(
        db.scalars(
            select(Participant)
            .where(
                Participant.meeting_id == meeting.id,
                Participant.status == ParticipantStatus.in_meeting,
            )
            .order_by(Participant.joined_at)
        ).all()
    )


def join_meeting(db: Session, meeting: Meeting, data: schemas.JoinRequest) -> Participant:
    is_host = data.user_id is not None and data.user_id == meeting.host_id

    if meeting.status == MeetingStatus.ended and not is_host:
        raise BadRequest("This meeting has ended")
    # The host already has the passcode, and the dashboard joins without one.
    if not is_host and (data.passcode or "").strip() != meeting.passcode:
        raise Forbidden("Incorrect meeting passcode")

    now = utcnow()
    if meeting.status != MeetingStatus.live:
        # First person in (or the host restarting an ended meeting) opens the meeting.
        meeting.status = MeetingStatus.live
        meeting.started_at = now
        meeting.ended_at = None

    participant = Participant(
        meeting_id=meeting.id,
        user_id=data.user_id,
        display_name=data.display_name,
        role=ParticipantRole.host if is_host else ParticipantRole.attendee,
        is_muted=data.is_muted,
        is_video_on=data.is_video_on,
        joined_at=now,
        last_seen_at=now,
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


def _close_if_empty(db: Session, meeting: Meeting) -> None:
    """When the last person leaves, the meeting is over."""
    if meeting.status == MeetingStatus.live and not active_participants(db, meeting):
        meeting.status = MeetingStatus.ended
        meeting.ended_at = utcnow()


def leave_meeting(db: Session, participant: Participant) -> None:
    if participant.status == ParticipantStatus.in_meeting:
        participant.status = ParticipantStatus.left
        participant.left_at = utcnow()
        db.flush()
        _close_if_empty(db, participant.meeting)
    db.commit()


def expire_stale_participants(db: Session, meeting: Meeting) -> None:
    """Mark people as left if their browser stopped checking in (tab closed, lost network)."""
    cutoff = utcnow() - timedelta(seconds=PARTICIPANT_TIMEOUT_SECONDS)
    changed = False
    for p in active_participants(db, meeting):
        if p.last_seen_at < cutoff:
            p.status = ParticipantStatus.left
            p.left_at = utcnow()
            changed = True
    if changed:
        db.flush()
        _close_if_empty(db, meeting)
        db.commit()


def expire_stale_everywhere(db: Session) -> None:
    """Run the same clean up for every live meeting.

    Called when the dashboard loads, so a meeting everyone left by closing
    their tab still moves from "live" to "ended".
    """
    live = db.scalars(select(Meeting).where(Meeting.status == MeetingStatus.live)).all()
    for meeting in live:
        expire_stale_participants(db, meeting)


def update_participant(
    db: Session, participant: Participant, data: schemas.ParticipantUpdate
) -> Participant:
    """A participant changing their own mic, camera or raised hand."""
    if participant.status != ParticipantStatus.in_meeting:
        raise BadRequest("You are no longer in this meeting")
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(participant, field, value)
    db.commit()
    db.refresh(participant)
    return participant


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
    host = _require_host(db, target.meeting, requester_id)
    if target.id == host.id:
        raise BadRequest("The host cannot remove themselves")
    if target.status == ParticipantStatus.in_meeting:
        target.status = ParticipantStatus.removed
        target.left_at = utcnow()
    db.commit()


def end_for_all(db: Session, meeting: Meeting, requester_id: int) -> Meeting:
    _require_host(db, meeting, requester_id)
    return end_meeting(db, meeting)


def send_message(
    db: Session, meeting: Meeting, data: schemas.ChatMessageCreate
) -> ChatMessage:
    sender = db.get(Participant, data.participant_id)
    if (
        sender is None
        or sender.meeting_id != meeting.id
        or sender.status != ParticipantStatus.in_meeting
    ):
        raise Forbidden("Only people in the meeting can send messages")
    message = ChatMessage(
        meeting_id=meeting.id, participant_id=sender.id, content=data.content
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def to_message_out(message: ChatMessage) -> schemas.ChatMessageOut:
    return schemas.ChatMessageOut(
        id=message.id,
        participant_id=message.participant_id,
        sender_name=message.participant.display_name,
        content=message.content,
        sent_at=message.sent_at,
    )


def list_messages(db: Session, meeting: Meeting, after_id: int = 0) -> list[ChatMessage]:
    return list(
        db.scalars(
            select(ChatMessage)
            .where(ChatMessage.meeting_id == meeting.id, ChatMessage.id > after_id)
            .order_by(ChatMessage.id)
        ).all()
    )


def room_state(
    db: Session, meeting: Meeting, participant: Participant, after_message_id: int
) -> schemas.RoomState:
    """One call the meeting room makes every couple of seconds.

    It also counts as a check in, so we know this person is still here.
    """
    if participant.meeting_id != meeting.id:
        raise BadRequest("Participant does not belong to this meeting")
    if participant.status == ParticipantStatus.in_meeting:
        participant.last_seen_at = utcnow()
        db.commit()
    expire_stale_participants(db, meeting)
    db.refresh(meeting)
    db.refresh(participant)
    return schemas.RoomState(
        meeting=to_meeting_out(db, meeting),
        me=schemas.ParticipantOut.model_validate(participant),
        participants=[
            schemas.ParticipantOut.model_validate(p)
            for p in active_participants(db, meeting)
        ],
        messages=[to_message_out(m) for m in list_messages(db, meeting, after_message_id)],
    )
