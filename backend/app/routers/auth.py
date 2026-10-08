from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.dependencies import bearer_token
from app.services import auth as auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=schemas.AuthResult, status_code=status.HTTP_201_CREATED)
def sign_up(data: schemas.SignUp, db: Session = Depends(get_db)):
    return auth_service.sign_up(db, data)


@router.post("/login", response_model=schemas.AuthResult)
def sign_in(data: schemas.SignIn, db: Session = Depends(get_db)):
    return auth_service.sign_in(db, data)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(token: str | None = Depends(bearer_token), db: Session = Depends(get_db)):
    if token:
        auth_service.sign_out(db, token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
