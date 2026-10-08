"""Endpoints that act on one participant.

Every request must carry the acting participant's secret key in the
X-Participant-Token header (see participant_service.authenticate).
"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.dependencies import participant_token
from app.services import host_controls as host_service
from app.services import participants as participant_service
from app.services import signals as signal_service

router = APIRouter(prefix="/api/participants", tags=["participants"])


@router.patch("/{participant_id}", response_model=schemas.ParticipantOut)
def update_self(
    participant_id: int,
    data: schemas.ParticipantUpdate,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    participant = participant_service.authenticate(db, participant_id, token)
    return participant_service.update_participant(db, participant, data)


@router.post("/{participant_id}/signals", status_code=status.HTTP_204_NO_CONTENT)
def send_signal(
    participant_id: int,
    data: schemas.SignalIn,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    """WebRTC: leave a connection note (offer or answer) for another participant."""
    sender = participant_service.authenticate(db, participant_id, token)
    signal_service.send_signal(db, sender, data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{participant_id}/signals", response_model=list[schemas.SignalOut])
def take_signals(
    participant_id: int,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    """WebRTC: collect connection notes left for this participant."""
    me = participant_service.authenticate(db, participant_id, token)
    return signal_service.take_signals(db, me)


@router.post("/{participant_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave(
    participant_id: int,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    participant = participant_service.authenticate(db, participant_id, token)
    participant_service.leave_meeting(db, participant)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _host_target(db: Session, participant_id: int, requester_id: int, token: str | None):
    """Check the requester's key, then return the person they want to act on."""
    participant_service.authenticate(db, requester_id, token)
    return participant_service.get_participant(db, participant_id)


@router.post("/{participant_id}/mute", response_model=schemas.ParticipantOut)
def host_mute(
    participant_id: int,
    data: schemas.HostAction,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    target = _host_target(db, participant_id, data.requester_id, token)
    return host_service.host_mute(db, target, data.requester_id)


@router.post("/{participant_id}/remove", status_code=status.HTTP_204_NO_CONTENT)
def remove(
    participant_id: int,
    data: schemas.HostAction,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    target = _host_target(db, participant_id, data.requester_id, token)
    host_service.remove_participant(db, target, data.requester_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{participant_id}/admit", response_model=schemas.ParticipantOut)
def admit(
    participant_id: int,
    data: schemas.HostAction,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    target = _host_target(db, participant_id, data.requester_id, token)
    return host_service.admit(db, target, data.requester_id)


@router.post("/{participant_id}/rename", response_model=schemas.ParticipantOut)
def host_rename(
    participant_id: int,
    data: schemas.HostRename,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    target = _host_target(db, participant_id, data.requester_id, token)
    return host_service.host_rename(db, target, data.requester_id, data.display_name)


@router.post("/{participant_id}/make-host", response_model=schemas.ParticipantOut)
def make_host(
    participant_id: int,
    data: schemas.HostAction,
    db: Session = Depends(get_db),
    token: str | None = Depends(participant_token),
):
    target = _host_target(db, participant_id, data.requester_id, token)
    return host_service.make_host(db, target, data.requester_id)
