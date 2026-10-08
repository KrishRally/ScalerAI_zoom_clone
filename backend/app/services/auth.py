"""Accounts: sign up, sign in, sign out, profile, password and personal settings."""

import random
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import schemas
from app.config import SESSION_DAYS
from app.models import AuthSession, User, UserSettings, utcnow
from app.services.codes import generate_personal_meeting_id
from app.services.errors import BadRequest, Conflict, Unauthorized
from app.services.security import hash_password, hash_token, new_token, verify_password

AVATAR_COLORS = ["#0E71EB", "#E8710A", "#1E8E3E", "#A142F4", "#D93025", "#12A4AF", "#C2185B"]


def _normalize_email(email: str) -> str:
    # Emails are compared case-insensitively, so "Krish@Gmail.com" and "krish@gmail.com" are one account.
    return email.strip().lower()


def _start_session(db: Session, user: User) -> str:
    token, token_hash = new_token()
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=utcnow() + timedelta(days=SESSION_DAYS),
        )
    )
    db.commit()
    return token


def get_user_settings(db: Session, user: User) -> UserSettings:
    """The user's settings row, created with defaults the first time it's needed."""
    if user.settings is None:
        user.settings = UserSettings()
        db.commit()
        db.refresh(user)
    return user.settings


def sign_up(db: Session, data: schemas.SignUp) -> schemas.AuthResult:
    email = _normalize_email(data.email)
    if db.scalar(select(User.id).where(User.email == email)):
        raise Conflict("An account with this email already exists. Please sign in.")
    user = User(
        name=data.name,
        email=email,
        password_hash=hash_password(data.password),
        avatar_color=random.choice(AVATAR_COLORS),
        personal_meeting_id=generate_personal_meeting_id(),
        settings=UserSettings(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return schemas.AuthResult(token=_start_session(db, user), user=schemas.UserOut.model_validate(user))


def sign_in(db: Session, data: schemas.SignIn) -> schemas.AuthResult:
    user = db.scalar(select(User).where(User.email == _normalize_email(data.email)))
    # Same message either way, so nobody can use this to find out which emails have accounts.
    if user is None or not verify_password(data.password, user.password_hash):
        raise Unauthorized("Incorrect email or password")
    return schemas.AuthResult(token=_start_session(db, user), user=schemas.UserOut.model_validate(user))


def sign_out(db: Session, token: str) -> None:
    db.execute(delete(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    db.commit()


def user_from_token(db: Session, token: str | None) -> User | None:
    """The signed in user for a token, or None if it's missing, unknown or expired."""
    if not token:
        return None
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    if session is None:
        return None
    if session.expires_at < utcnow():
        db.delete(session)
        db.commit()
        return None
    return session.user


def update_profile(db: Session, user: User, data: schemas.ProfileUpdate) -> User:
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, data: schemas.PasswordChange, current_token: str) -> None:
    if not verify_password(data.current_password, user.password_hash):
        raise BadRequest("Your current password is incorrect")
    user.password_hash = hash_password(data.new_password)
    # Sign out every other browser, but keep this one signed in.
    db.execute(
        delete(AuthSession).where(
            AuthSession.user_id == user.id, AuthSession.token_hash != hash_token(current_token)
        )
    )
    db.commit()


def update_user_settings(
    db: Session, user: User, data: schemas.UserSettingsUpdate
) -> UserSettings:
    settings = get_user_settings(db, user)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings
