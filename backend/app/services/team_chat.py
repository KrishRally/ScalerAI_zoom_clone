"""Team Chat: channels, direct messages, unread counts.

Everyone has Team Chat. You only see chats you are a member of, so the seeded
sample chats stay on the demo account and new accounts start empty.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas
from app.models import ChannelMember, ChannelMessage, ChatChannel, User
from app.services.errors import BadRequest, Forbidden, NotFound

def person(user: User) -> schemas.PersonOut:
    return schemas.PersonOut.model_validate(user)


def _membership(db: Session, channel_id: int, user: User) -> ChannelMember:
    """The user's membership row, or an error if they can't see this channel."""
    member = db.scalar(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id, ChannelMember.user_id == user.id
        )
    )
    if member is None:
        if db.get(ChatChannel, channel_id) is None:
            raise NotFound("Conversation not found")
        raise Forbidden("You are not a member of this conversation")
    return member


def _message_out(message: ChannelMessage) -> schemas.ChannelMessageOut:
    return schemas.ChannelMessageOut(
        id=message.id,
        channel_id=message.channel_id,
        sender=person(message.user),
        content=message.content,
        created_at=message.created_at,
    )


def _channel_out(db: Session, channel: ChatChannel, me: User, last_read: int) -> schemas.ChannelOut:
    members = [m.user for m in channel.members]
    if channel.is_direct:
        others = [u for u in members if u.id != me.id]
        name = ", ".join(u.name for u in others) or f"{me.name} (you)"
    else:
        name = channel.name or "Channel"
    last = db.scalar(
        select(ChannelMessage)
        .where(ChannelMessage.channel_id == channel.id)
        .order_by(ChannelMessage.id.desc())
        .limit(1)
    )
    # Unread = messages from other people newer than what I've read.
    unread = db.scalar(
        select(func.count(ChannelMessage.id)).where(
            ChannelMessage.channel_id == channel.id,
            ChannelMessage.id > last_read,
            ChannelMessage.user_id != me.id,
        )
    )
    return schemas.ChannelOut(
        id=channel.id,
        name=name,
        is_direct=channel.is_direct,
        is_default=channel.is_default,
        members=[person(u) for u in sorted(members, key=lambda u: u.name.lower())],
        unread_count=unread or 0,
        last_message=_message_out(last) if last else None,
    )


def list_channels(db: Session, me: User) -> list[schemas.ChannelOut]:
    memberships = db.scalars(select(ChannelMember).where(ChannelMember.user_id == me.id)).all()
    channels = [_channel_out(db, m.channel, me, m.last_read_message_id) for m in memberships]
    # Most recently active first, like Zoom's chat list.
    return sorted(
        channels,
        key=lambda c: (c.last_message.id if c.last_message else 0, -c.id),
        reverse=True,
    )


def total_unread(db: Session, me: User) -> int:
    memberships = db.scalars(select(ChannelMember).where(ChannelMember.user_id == me.id)).all()
    total = 0
    for m in memberships:
        total += db.scalar(
            select(func.count(ChannelMessage.id)).where(
                ChannelMessage.channel_id == m.channel_id,
                ChannelMessage.id > m.last_read_message_id,
                ChannelMessage.user_id != me.id,
            )
        ) or 0
    return total


def _users_by_ids(db: Session, ids: list[int]) -> list[User]:
    users = list(db.scalars(select(User).where(User.id.in_(set(ids)))).all())
    if len(users) != len(set(ids)):
        raise BadRequest("Some of those people don't exist")
    return users


def create_channel(db: Session, me: User, data: schemas.ChannelCreate) -> schemas.ChannelOut:
    others = _users_by_ids(db, [i for i in data.member_ids if i != me.id]) if data.member_ids else []
    channel = ChatChannel(name=data.name, created_by=me.id)
    channel.members = [ChannelMember(user_id=me.id)] + [ChannelMember(user_id=u.id) for u in others]
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return _channel_out(db, channel, me, 0)


def open_direct_message(db: Session, me: User, other_id: int) -> schemas.ChannelOut:
    """Get the existing DM with this person, or start one. Messaging yourself works too."""
    other = db.get(User, other_id)
    if other is None:
        raise NotFound("That person doesn't exist")
    wanted = {me.id, other.id}
    my_dms = db.scalars(
        select(ChatChannel)
        .join(ChannelMember, ChannelMember.channel_id == ChatChannel.id)
        .where(ChatChannel.is_direct.is_(True), ChannelMember.user_id == me.id)
    ).all()
    for channel in my_dms:
        if {m.user_id for m in channel.members} == wanted:
            member = _membership(db, channel.id, me)
            return _channel_out(db, channel, me, member.last_read_message_id)

    channel = ChatChannel(is_direct=True, created_by=me.id)
    channel.members = [ChannelMember(user_id=uid) for uid in wanted]
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return _channel_out(db, channel, me, 0)


def list_messages(
    db: Session, me: User, channel_id: int, after_id: int = 0, limit: int = 200
) -> list[schemas.ChannelMessageOut]:
    _membership(db, channel_id, me)
    query = select(ChannelMessage).where(
        ChannelMessage.channel_id == channel_id, ChannelMessage.id > after_id
    )
    if after_id:
        messages = db.scalars(query.order_by(ChannelMessage.id).limit(limit)).all()
    else:
        # First load: the latest messages, shown oldest to newest.
        messages = list(reversed(db.scalars(query.order_by(ChannelMessage.id.desc()).limit(limit)).all()))
    return [_message_out(m) for m in messages]


def send_message(
    db: Session, me: User, channel_id: int, data: schemas.ChannelMessageCreate
) -> schemas.ChannelMessageOut:
    member = _membership(db, channel_id, me)
    message = ChannelMessage(channel_id=channel_id, user_id=me.id, content=data.content)
    db.add(message)
    db.flush()
    # Your own message counts as read.
    member.last_read_message_id = message.id
    db.commit()
    db.refresh(message)
    return _message_out(message)


def mark_read(db: Session, me: User, channel_id: int) -> None:
    member = _membership(db, channel_id, me)
    latest = db.scalar(
        select(func.max(ChannelMessage.id)).where(ChannelMessage.channel_id == channel_id)
    )
    member.last_read_message_id = latest or 0
    db.commit()


def search_people(db: Session, query: str, limit: int = 10) -> list[schemas.PersonOut]:
    """Find people with an account by name or email, for starting chats and sharing docs."""
    q = query.strip().lower()
    if not q:
        return []
    like = f"%{q}%"
    users = db.scalars(
        select(User)
        .where(func.lower(User.name).like(like) | func.lower(User.email).like(like))
        .order_by(User.name)
        .limit(limit)
    ).all()
    return [person(u) for u in users]
