"""Private meeting notes (like Zoom's "My Notes"), one per person per meeting."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.models import (
    Meeting,
    MeetingNote,
    Participant,
    User,
    utcnow,
)
from app.services.errors import Forbidden


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
