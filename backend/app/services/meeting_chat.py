"""In-meeting chat and emoji reactions."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.models import (
    ChatMessage,
    Meeting,
    Participant,
    ParticipantRole,
    ParticipantStatus,
    Reaction,
    utcnow,
)
from app.services.errors import Forbidden
from app.services.meetings import get_settings


# How long a reaction stays on screen.
REACTION_SECONDS = 6


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
