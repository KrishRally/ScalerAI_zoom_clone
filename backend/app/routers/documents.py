"""Docs endpoints. Everything here needs a signed in user."""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services import documents as doc_service

router = APIRouter(prefix="/api/docs", tags=["docs"])


@router.get("", response_model=list[schemas.DocumentSummary])
def list_documents(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return doc_service.list_documents(db, user)


@router.post("", response_model=schemas.DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(
    data: schemas.DocumentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return doc_service.create_document(db, user, data)


@router.get("/{doc_id}", response_model=schemas.DocumentOut)
def get_document(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return doc_service.get_document(db, user, doc_id)


@router.patch("/{doc_id}", response_model=schemas.DocumentOut)
def update_document(
    doc_id: int,
    data: schemas.DocumentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return doc_service.update_document(db, user, doc_id, data)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc_service.delete_document(db, user, doc_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{doc_id}/members", response_model=schemas.DocumentOut)
def share(
    doc_id: int,
    data: schemas.DocumentShare,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return doc_service.share_document(db, user, doc_id, data)


@router.delete("/{doc_id}/members/{member_user_id}", response_model=schemas.DocumentOut)
def unshare(
    doc_id: int,
    member_user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return doc_service.unshare_document(db, user, doc_id, member_user_id)
