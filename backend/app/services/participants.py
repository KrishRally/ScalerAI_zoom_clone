"""Participant rules: join, waiting room, leave, check in, host controls, chat, reactions, notes."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.config import PARTICIPANT_TIMEOUT_SECONDS
from app.models import (
    ChatMessage,
    Meeting,
    MeetingNote,
    MeetingStatus,
    Participant,
    ParticipantRole,
    ParticipantStatus,
    Reaction,
    User,
    utcnow,
)
from app.services.errors import BadRequest, Forbidden, NotFound
from app.services.meetings import end_meeting, get_settings, to_meeting_out

# How long a reaction stays on screen.
REACTION_SECONDS = 6


def get_participant(db: Session, participant_id: int) -> Participant:
    participant = db.get(Participant, participant_id)
    if participant is None:
        raise NotFound("Participant not found")
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


def join_meeting(db: Session, meeting: Meeting, data: schemas.JoinRequest) -> Participant:
    is_owner = data.user_id is not None and data.user_id == meeting.host_id
    settings = get_settings(db, meeting)

    if meeting.status == MeetingStatus.ended and not is_owner:
        raise BadRequest("This meeting has ended")
    # The host already has the passcode, and the dashboard joins without one.
    if not is_owner and (data.passcode or "").strip() != meeting.passcode:
        raise Forbidden("Incorrect meeting passcode")
    if settings.is_locked and not is_owner:
        raise Forbidden("This meeting has been locked by the host")

    now = utcnow()
    goes_to_waiting_room = settings.waiting_room and not is_owner

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

    participant = Participant(
        meeting_id=meeting.id,
        user_id=data.user_id,
        display_name=data.display_name,
        role=ParticipantRole.host if is_owner else ParticipantRole.attendee,
        status=ParticipantStatus.waiting if goes_to_waiting_room else ParticipantStatus.in_meeting,
        is_muted=is_muted,
        is_video_on=is_video_on,
        joined_at=now,
        last_seen_at=now,
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


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

    for field, value in changes.items():
        setattr(participant, field, value)
    db.commit()
    db.refresh(participant)
    return participant


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
    # Turning the waiting room off lets everyone who was waiting in, like Zoom.
    if changes.get("waiting_room") is False:
        for p in waiting_participants(db, meeting):
            _admit(p)
    db.commit()
    return schemas.SettingsOut.model_validate(settings)


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
    db.commit()
    return schemas.SettingsOut.model_validate(settings)


def end_for_all(db: Session, meeting: Meeting, requester_id: int) -> Meeting:
    _require_host(db, meeting, requester_id)
    for p in waiting_participants(db, meeting):
        p.status = ParticipantStatus.left
        p.left_at = utcnow()
    return end_meeting(db, meeting)


# ---------- Chat and reactions ----------


def _require_in_meeting(meeting: Meeting, participant: Participant | None, action: str) -> Participant:
    if (
        participant is None
        or participant.meeting_id != meeting.id
        or participant.status != ParticipantStatus.in_meeting
    ):
        raise Forbidden(f"Only people in the meeting can {action}")
    return participant


def send_message(
    db: Session, meeting: Meeting, data: schemas.ChatMessageCreate
) -> ChatMessage:
    sender = _require_in_meeting(meeting, db.get(Participant, data.participant_id), "send messages")
    if sender.role != ParticipantRole.host and not get_settings(db, meeting).allow_chat:
        raise Forbidden("The host has disabled chat")
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


def send_reaction(db: Session, meeting: Meeting, data: schemas.ReactionCreate) -> Reaction:
    sender = _require_in_meeting(meeting, db.get(Participant, data.participant_id), "react")
    if sender.role != ParticipantRole.host and not get_settings(db, meeting).allow_reactions:
        raise Forbidden("The host has disabled reactions")
    reaction = Reaction(meeting_id=meeting.id, participant_id=sender.id, emoji=data.emoji)
    db.add(reaction)
    db.commit()
    db.refresh(reaction)
    return reaction


def recent_reactions(db: Session, meeting: Meeting) -> list[Reaction]:
    since = utcnow() - timedelta(seconds=REACTION_SECONDS)
    return list(
        db.scalars(
            select(Reaction)
            .where(Reaction.meeting_id == meeting.id, Reaction.created_at > since)
            .order_by(Reaction.id)
        ).all()
    )


# ---------- Notes ----------


def _find_note(db: Session, meeting: Meeting, participant: Participant) -> MeetingNote | None:
    query = select(MeetingNote).where(MeetingNote.meeting_id == meeting.id)
    if participant.user_id is not None:
        query = query.where(MeetingNote.user_id == participant.user_id)
    else:
        query = query.where(MeetingNote.participant_id == participant.id)
    return db.scalar(query)


def _note_owner(db: Session, meeting: Meeting, participant_id: int) -> Participant:
    participant = db.get(Participant, participant_id)
    if participant is None or participant.meeting_id != meeting.id:
        raise Forbidden("You are not part of this meeting")
    return participant


def get_note(db: Session, meeting: Meeting, participant_id: int) -> schemas.NoteOut:
    note = _find_note(db, meeting, _note_owner(db, meeting, participant_id))
    return schemas.NoteOut(content=note.content if note else "", updated_at=note.updated_at if note else None)


def save_note(db: Session, meeting: Meeting, data: schemas.NoteSave) -> schemas.NoteOut:
    participant = _note_owner(db, meeting, data.participant_id)
    note = _find_note(db, meeting, participant)
    if note is None:
        note = MeetingNote(
            meeting_id=meeting.id,
            # Signed in users keep one note per meeting; guests get one per visit.
            user_id=participant.user_id,
            participant_id=None if participant.user_id is not None else participant.id,
        )
        db.add(note)
    note.content = data.content
    note.updated_at = utcnow()
    db.commit()
    db.refresh(note)
    return schemas.NoteOut(content=note.content, updated_at=note.updated_at)


def get_user_note(db: Session, meeting: Meeting, user: User) -> schemas.NoteOut:
    """The signed in user's notes for a meeting, shown on the Meetings page afterwards."""
    note = db.scalar(
        select(MeetingNote).where(
            MeetingNote.meeting_id == meeting.id, MeetingNote.user_id == user.id
        )
    )
    return schemas.NoteOut(content=note.content if note else "", updated_at=note.updated_at if note else None)


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
