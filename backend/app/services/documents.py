"""Docs: personal documents that can be shared with other people by email."""

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import schemas
from app.models import Document, DocumentMember, User, utcnow
from app.services.errors import BadRequest, Forbidden, NotFound
from app.services.team_chat import person


def _access(db: Session, doc_id: int, user: User) -> tuple[Document, bool]:
    """The document and whether the user may edit it. Errors if they can't see it."""
    doc = db.get(Document, doc_id)
    if doc is None:
        raise NotFound("Document not found")
    if doc.owner_id == user.id:
        return doc, True
    member = next((m for m in doc.members if m.user_id == user.id), None)
    if member is None:
        # Same message as "not found", so nobody can probe which documents exist.
        raise NotFound("Document not found")
    return doc, member.can_edit


def _snippet(content: str) -> str:
    text = " ".join(content.split())
    return text[:140] + ("..." if len(text) > 140 else "")


def _summary(doc: Document, user: User, can_edit: bool) -> dict:
    return {
        "id": doc.id,
        "title": doc.title or "Untitled",
        "snippet": _snippet(doc.content),
        "owner": person(doc.owner),
        "is_owner": doc.owner_id == user.id,
        "can_edit": can_edit,
        "shared": bool(doc.members),
        "updated_at": doc.updated_at,
        "updated_by_name": doc.editor.name if doc.editor else None,
    }


def _full(doc: Document, user: User, can_edit: bool) -> schemas.DocumentOut:
    return schemas.DocumentOut(
        **_summary(doc, user, can_edit),
        content=doc.content,
        members=[
            schemas.DocumentMemberOut(user=person(m.user), can_edit=m.can_edit)
            for m in sorted(doc.members, key=lambda m: m.user.name.lower())
        ],
    )


def list_documents(db: Session, user: User) -> list[schemas.DocumentSummary]:
    shared_ids = select(DocumentMember.document_id).where(DocumentMember.user_id == user.id)
    docs = db.scalars(
        select(Document)
        .where(or_(Document.owner_id == user.id, Document.id.in_(shared_ids)))
        .order_by(Document.updated_at.desc())
    ).all()
    result = []
    for doc in docs:
        can_edit = doc.owner_id == user.id or any(
            m.user_id == user.id and m.can_edit for m in doc.members
        )
        result.append(schemas.DocumentSummary(**_summary(doc, user, can_edit)))
    return result


def create_document(db: Session, user: User, data: schemas.DocumentCreate) -> schemas.DocumentOut:
    doc = Document(
        owner_id=user.id,
        title=data.title.strip() or "Untitled",
        content=data.content,
        updated_by=user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _full(doc, user, True)


def get_document(db: Session, user: User, doc_id: int) -> schemas.DocumentOut:
    doc, can_edit = _access(db, doc_id, user)
    return _full(doc, user, can_edit)


def update_document(
    db: Session, user: User, doc_id: int, data: schemas.DocumentUpdate
) -> schemas.DocumentOut:
    doc, can_edit = _access(db, doc_id, user)
    if not can_edit:
        raise Forbidden("You can view this document but not edit it")
    if data.title is not None:
        doc.title = data.title.strip() or "Untitled"
    if data.content is not None:
        doc.content = data.content
    doc.updated_at = utcnow()
    doc.updated_by = user.id
    db.commit()
    db.refresh(doc)
    return _full(doc, user, can_edit)


def delete_document(db: Session, user: User, doc_id: int) -> None:
    doc, _ = _access(db, doc_id, user)
    if doc.owner_id != user.id:
        raise Forbidden("Only the owner can delete this document")
    db.delete(doc)
    db.commit()


def share_document(
    db: Session, user: User, doc_id: int, data: schemas.DocumentShare
) -> schemas.DocumentOut:
    doc, _ = _access(db, doc_id, user)
    if doc.owner_id != user.id:
        raise Forbidden("Only the owner can share this document")
    target = db.scalar(select(User).where(User.email == data.email.strip().lower()))
    if target is None:
        raise NotFound("No one with that email has an account yet. Ask them to sign up first.")
    if target.id == user.id:
        raise BadRequest("You already own this document")
    member = next((m for m in doc.members if m.user_id == target.id), None)
    if member is None:
        doc.members.append(DocumentMember(user_id=target.id, can_edit=data.can_edit))
    else:
        member.can_edit = data.can_edit
    db.commit()
    db.refresh(doc)
    return _full(doc, user, True)


def unshare_document(db: Session, user: User, doc_id: int, member_user_id: int) -> schemas.DocumentOut:
    doc, can_edit = _access(db, doc_id, user)
    # The owner can remove anyone; others can only remove themselves.
    if doc.owner_id != user.id and member_user_id != user.id:
        raise Forbidden("Only the owner can change who this is shared with")
    doc.members = [m for m in doc.members if m.user_id != member_user_id]
    db.commit()
    db.refresh(doc)
    return _full(doc, user, can_edit)
