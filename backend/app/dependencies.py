"""Shared FastAPI dependencies."""

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.seed import DEFAULT_USER_EMAIL
from app.services.errors import NotFound


def get_current_user(db: Session = Depends(get_db)) -> User:
    """No login in this app: the seeded default user is always the one signed in.

    With real authentication, this is the only function that would change
    (read a token, look up that user).
    """
    user = db.scalar(select(User).where(User.email == DEFAULT_USER_EMAIL))
    if user is None:
        raise NotFound("Default user missing. Restart the server to seed the database.")
    return user
