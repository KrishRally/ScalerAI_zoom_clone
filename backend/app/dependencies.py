"""Shared FastAPI dependencies: who is signed in, and which participant is acting."""

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.services.auth import user_from_token
from app.services.errors import Unauthorized


def bearer_token(authorization: str | None = Header(default=None)) -> str | None:
    """The token from an "Authorization: Bearer <token>" header, if any."""
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def get_optional_user(
    token: str | None = Depends(bearer_token), db: Session = Depends(get_db)
) -> User | None:
    """The signed in user, or None for guests (people joining from an invite link)."""
    return user_from_token(db, token)


def get_current_user(user: User | None = Depends(get_optional_user)) -> User:
    """For pages that need an account, like the dashboard."""
    if user is None:
        raise Unauthorized("Please sign in to continue")
    return user


def participant_token(x_participant_token: str | None = Header(default=None)) -> str | None:
    """The secret key a participant got when joining. Sent as "X-Participant-Token"."""
    return x_participant_token
