"""The bell in the top bar: unread chats, docs shared with you, meetings starting soon.

Nothing is stored per notification. Each one is built from data the app already
has, and users.notifications_seen_at decides which ones are new.
"""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.models import DocumentMember, User, utcnow
from app.services.meetings import list_upcoming
from app.services.team_chat import list_channels, person

# Meetings show up in the bell this long before they start.
MEETING_REMINDER = timedelta(hours=1)
# Docs shared with you stay in the bell for this long.
SHARE_WINDOW = timedelta(days=14)
MAX_ITEMS = 20


def list_notifications(db: Session, me: User) -> schemas.NotificationsOut:
    now = utcnow()
    items: list[dict] = []

    for c in list_channels(db, me):
        last = c.last_message
        if c.unread_count == 0 or last is None or last.sender.id == me.id:
            continue
        where = "sent you a message" if c.is_direct else f"posted in #{c.name}"
        more = f" (+{c.unread_count - 1} more)" if c.unread_count > 1 else ""
        items.append(
            dict(
                id=f"chat-{c.id}",
                kind="chat",
                title=f"{last.sender.name} {where}",
                body=last.content[:140] + more,
                created_at=last.created_at,
                link=f"/chat?c={c.id}",
                actor=last.sender,
            )
        )

    shares = db.scalars(
        select(DocumentMember).where(
            DocumentMember.user_id == me.id, DocumentMember.added_at > now - SHARE_WINDOW
        )
    ).all()
    for share in shares:
        doc = share.document
        items.append(
            dict(
                id=f"doc-{doc.id}",
                kind="doc",
                title=f'{doc.owner.name} shared "{doc.title}" with you',
                body="You can edit it" if share.can_edit else "You can view it",
                created_at=share.added_at,
                link=f"/docs/{doc.id}",
                actor=person(doc.owner),
            )
        )

    for m in list_upcoming(db, me):
        start = m.scheduled_start
        if start is None or start - now > MEETING_REMINDER:
            continue
        minutes = int((start - now).total_seconds() // 60)
        when = "is happening now" if minutes <= 0 else f"starts in {minutes} min"
        items.append(
            dict(
                id=f"meeting-{m.id}",
                kind="meeting",
                title=f"{m.title} {when}",
                body=f"Meeting ID {m.meeting_code}",
                # It "arrives" an hour before the start (or when it was scheduled, if later).
                created_at=max(start - MEETING_REMINDER, m.created_at),
                link="/meetings",
                meeting_code=m.meeting_code,
            )
        )

    items.sort(key=lambda i: i["created_at"], reverse=True)
    items = items[:MAX_ITEMS]
    seen = me.notifications_seen_at
    out = [schemas.NotificationOut(**i, unseen=seen is None or i["created_at"] > seen) for i in items]
    return schemas.NotificationsOut(items=out, unseen=sum(n.unseen for n in out))


def mark_seen(db: Session, me: User) -> None:
    me.notifications_seen_at = utcnow()
    db.commit()
