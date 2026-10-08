"""The notifications bell."""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services import notifications as notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=schemas.NotificationsOut)
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return notification_service.list_notifications(db, user)


@router.post("/seen", status_code=status.HTTP_204_NO_CONTENT)
def mark_seen(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    notification_service.mark_seen(db, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
