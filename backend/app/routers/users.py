from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.dependencies import bearer_token, get_current_user
from app.models import User
from app.services import auth as auth_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=schemas.UserOut)
def read_me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=schemas.UserOut)
def update_me(
    data: schemas.ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return auth_service.update_profile(db, user, data)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: schemas.PasswordChange,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    token: str | None = Depends(bearer_token),
):
    auth_service.change_password(db, user, data, token or "")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/settings", response_model=schemas.UserSettingsOut)
def read_settings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return auth_service.get_user_settings(db, user)


@router.patch("/me/settings", response_model=schemas.UserSettingsOut)
def update_settings(
    data: schemas.UserSettingsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return auth_service.update_user_settings(db, user, data)
