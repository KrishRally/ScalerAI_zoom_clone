"""WebRTC signalling: browsers pass offers and answers to each other through here."""

import json
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.models import (
    Participant,
    ParticipantStatus,
    Signal,
    utcnow,
)
from app.services.errors import BadRequest


SIGNAL_MAX_AGE = timedelta(minutes=2)


def send_signal(db: Session, sender: Participant, data: schemas.SignalIn) -> None:
    """Pass a connection note to another person in the same meeting."""
    target = db.get(Participant, data.to)
    if (
        sender.status != ParticipantStatus.in_meeting
        or target is None
        or target.meeting_id != sender.meeting_id
        or target.status != ParticipantStatus.in_meeting
        or target.id == sender.id
    ):
        raise BadRequest("That person is not in this meeting")
    db.add(
        Signal(
            meeting_id=sender.meeting_id,
            from_participant_id=sender.id,
            to_participant_id=target.id,
            payload=json.dumps(data.data),
        )
    )
    db.commit()


def take_signals(db: Session, me: Participant) -> list[schemas.SignalOut]:
    """Notes waiting for this person, oldest first. They are deleted once handed over."""
    # Old notes nobody collected (the person left) are cleared out too.
    db.query(Signal).filter(Signal.created_at < utcnow() - SIGNAL_MAX_AGE).delete()
    rows = db.scalars(
        select(Signal).where(Signal.to_participant_id == me.id).order_by(Signal.id)
    ).all()
    out = [schemas.SignalOut(id=r.id, from_id=r.from_participant_id, data=json.loads(r.payload)) for r in rows]
    for r in rows:
        db.delete(r)
    db.commit()
    return out
