"""Team Chat endpoints. Everything here needs a signed in user."""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services import team_chat as chat_service

router = APIRouter(prefix="/api/chat", tags=["team chat"])


@router.get("/channels", response_model=list[schemas.ChannelOut])
def list_channels(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return chat_service.list_channels(db, user)


@router.get("/unread", response_model=schemas.UnreadOut)
def unread(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {"unread": chat_service.total_unread(db, user)}


@router.post("/channels", response_model=schemas.ChannelOut, status_code=status.HTTP_201_CREATED)
def create_channel(
    data: schemas.ChannelCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return chat_service.create_channel(db, user, data)


@router.post("/direct", response_model=schemas.ChannelOut)
def open_direct(
    data: schemas.DirectMessageCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return chat_service.open_direct_message(db, user, data.user_id)


@router.post("/channels/{channel_id}/members", response_model=schemas.ChannelOut)
def add_members(
    channel_id: int,
    data: schemas.ChannelMembersAdd,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return chat_service.add_members(db, user, channel_id, data)


@router.delete("/channels/{channel_id}/members/me", status_code=status.HTTP_204_NO_CONTENT)
def leave(channel_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    chat_service.leave_channel(db, user, channel_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/channels/{channel_id}/messages", response_model=list[schemas.ChannelMessageOut])
def list_messages(
    channel_id: int,
    after_id: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return chat_service.list_messages(db, user, channel_id, after_id)


@router.post(
    "/channels/{channel_id}/messages",
    response_model=schemas.ChannelMessageOut,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    channel_id: int,
    data: schemas.ChannelMessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return chat_service.send_message(db, user, channel_id, data)


@router.post("/channels/{channel_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(channel_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    chat_service.mark_read(db, user, channel_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
