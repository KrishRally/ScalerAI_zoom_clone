"""Endpoints that act on one participant."""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.services import participants as participant_service

router = APIRouter(prefix="/api/participants", tags=["participants"])


@router.patch("/{participant_id}", response_model=schemas.ParticipantOut)
def update_self(
    participant_id: int, data: schemas.ParticipantUpdate, db: Session = Depends(get_db)
):
    participant = participant_service.get_participant(db, participant_id)
    return participant_service.update_participant(db, participant, data)


@router.post("/{participant_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave(participant_id: int, db: Session = Depends(get_db)):
    participant = participant_service.get_participant(db, participant_id)
    participant_service.leave_meeting(db, participant)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{participant_id}/mute", response_model=schemas.ParticipantOut)
def host_mute(
    participant_id: int, data: schemas.HostAction, db: Session = Depends(get_db)
):
    target = participant_service.get_participant(db, participant_id)
    return participant_service.host_mute(db, target, data.requester_id)


@router.post("/{participant_id}/remove", status_code=status.HTTP_204_NO_CONTENT)
def remove(participant_id: int, data: schemas.HostAction, db: Session = Depends(get_db)):
    target = participant_service.get_participant(db, participant_id)
    participant_service.remove_participant(db, target, data.requester_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
