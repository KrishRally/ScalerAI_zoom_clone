"""Sample data so the dashboard is not empty on first run.

The demo account (alex.johnson@example.com, password from DEMO_PASSWORD) lets
reviewers sign in straight away. Anyone can also sign up with their own email.

Runs on startup but only fills an empty database, so it never overwrites
meetings people have created. Times are relative to "now" so the
upcoming meetings are always in the future.
"""

import os
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import DEMO_EMAIL, DEMO_PASSWORD
from app.models import (
    ChannelMember,
    ChannelMessage,
    ChatChannel,
    ChatMessage,
    Document,
    DocumentMember,
    Meeting,
    MeetingSettings,
    MeetingStatus,
    MeetingType,
    Participant,
    ParticipantRole,
    ParticipantStatus,
    User,
    utcnow,
)
from app.services.codes import (
    generate_meeting_code,
    generate_passcode,
    generate_personal_meeting_id,
)
from app.services.meetings import list_upcoming
from app.services.security import hash_password

DEFAULT_USER_EMAIL = DEMO_EMAIL
DEFAULT_USER_NAME = os.getenv("DEFAULT_USER_NAME", "Alex Johnson")

_OTHER_USERS = [
    ("Priya Sharma", "priya.sharma@example.com", "#E8710A"),
    ("Daniel Kim", "daniel.kim@example.com", "#1E8E3E"),
    ("Sara Lopez", "sara.lopez@example.com", "#A142F4"),
    ("Rahul Verma", "rahul.verma@example.com", "#D93025"),
]

_UPCOMING = [
    # (title, description, starts in, duration minutes)
    ("Daily Standup", "Quick sync on yesterday, today and blockers.", timedelta(hours=2), 15),
    ("Design Review: Dashboard v2", "Walk through the new dashboard mockups.", timedelta(hours=5), 60),
    ("1:1 with Priya", None, timedelta(days=1, hours=1), 30),
    ("Sprint Planning", "Plan stories for the next two weeks.", timedelta(days=2, hours=3), 90),
    ("Client Demo: Acme Corp", "Demo the latest release to the Acme team.", timedelta(days=4), 45),
]

_RECENT = [
    # (title, type, started ago, lasted minutes, guests)
    (f"{DEFAULT_USER_NAME}'s Zoom Meeting", MeetingType.instant, timedelta(hours=3), 22, ["Priya Sharma", "Daniel Kim"]),
    ("Weekly Team Sync", MeetingType.scheduled, timedelta(days=1, hours=2), 48, ["Priya Sharma", "Daniel Kim", "Sara Lopez"]),
    ("Interview: Frontend Engineer", MeetingType.scheduled, timedelta(days=2, hours=5), 55, ["Rahul Verma"]),
    ("Quick Call", MeetingType.instant, timedelta(days=3, hours=1), 9, ["Sara Lopez"]),
]


def ensure_demo_password(db: Session) -> None:
    """Databases seeded before sign in existed have a demo user with no password. Give it one."""
    demo = db.scalar(select(User).where(User.email == DEFAULT_USER_EMAIL))
    if demo is not None and not demo.password_hash:
        demo.password_hash = hash_password(DEMO_PASSWORD)
        db.commit()


def _add_upcoming_samples(db: Session, me: User, now) -> None:
    for title, description, starts_in, duration in _UPCOMING:
        start = now + starts_in
        db.add(
            Meeting(
                meeting_code=generate_meeting_code(db),
                title=title,
                description=description,
                host_id=me.id,
                meeting_type=MeetingType.scheduled,
                status=MeetingStatus.scheduled,
                passcode=generate_passcode(),
                # Round to the hour or half hour like a real calendar.
                scheduled_start=start.replace(minute=0 if start.minute < 30 else 30, second=0, microsecond=0),
                duration_minutes=duration,
                settings=MeetingSettings(),
            )
        )
        db.flush()  # so the next meeting code is checked against this one


def refresh_sample_meetings(db: Session) -> None:
    """Sample times count from the day the database was first filled, so after a
    few days they are all in the past and the dashboard says "No upcoming
    meetings". When the demo user has nothing coming up, add a fresh set.

    Only when the list is empty, so a meeting someone deletes doesn't pop back.
    """
    me = db.scalar(select(User).where(User.email == DEFAULT_USER_EMAIL))
    if me is None or list_upcoming(db, me):
        return
    _add_upcoming_samples(db, me, utcnow())
    db.commit()


def seed_database(db: Session) -> None:
    if db.scalar(select(User.id).limit(1)) is not None:
        return  # already seeded

    me = User(
        name=DEFAULT_USER_NAME,
        email=DEFAULT_USER_EMAIL,
        password_hash=hash_password(DEMO_PASSWORD),
        avatar_color="#0E71EB",
        personal_meeting_id=generate_personal_meeting_id(),
    )
    db.add(me)
    others = {
        name: User(
            name=name,
            email=email,
            avatar_color=color,
            personal_meeting_id=generate_personal_meeting_id(),
        )
        for name, email, color in _OTHER_USERS
    }
    db.add_all(others.values())
    db.flush()  # gives every user an id

    now = utcnow()

    _add_upcoming_samples(db, me, now)

    for title, meeting_type, ago, lasted, guests in _RECENT:
        started = now - ago
        ended = started + timedelta(minutes=lasted)
        meeting = Meeting(
            meeting_code=generate_meeting_code(db),
            title=title,
            host_id=me.id,
            meeting_type=meeting_type,
            status=MeetingStatus.ended,
            passcode=generate_passcode(),
            scheduled_start=started if meeting_type == MeetingType.scheduled else None,
            duration_minutes=60,
            started_at=started,
            ended_at=ended,
            created_at=started - timedelta(minutes=5),
            settings=MeetingSettings(),
        )
        db.add(meeting)
        db.flush()

        host = Participant(
            meeting_id=meeting.id,
            user_id=me.id,
            display_name=me.name,
            role=ParticipantRole.host,
            status=ParticipantStatus.left,
            joined_at=started,
            left_at=ended,
            last_seen_at=ended,
        )
        db.add(host)
        for i, guest in enumerate(guests):
            db.add(
                Participant(
                    meeting_id=meeting.id,
                    user_id=others[guest].id,
                    display_name=guest,
                    role=ParticipantRole.attendee,
                    status=ParticipantStatus.left,
                    joined_at=started + timedelta(minutes=i + 1),
                    left_at=ended,
                    last_seen_at=ended,
                )
            )
        db.flush()
        db.add(
            ChatMessage(
                meeting_id=meeting.id,
                participant_id=host.id,
                content="Thanks for joining, everyone!",
                sent_at=started + timedelta(minutes=2),
            )
        )

    db.commit()


def _seed_users(db: Session) -> dict[str, User]:
    return {u.email: u for u in db.scalars(select(User)).all()}


def _sample_people(db: Session) -> dict[str, User]:
    """The demo account and its seeded teammates, not people who signed up."""
    emails = [DEFAULT_USER_EMAIL] + [email for _, email, _ in _OTHER_USERS]
    return {u.email: u for u in db.scalars(select(User).where(User.email.in_(emails))).all()}


def seed_team_chat(db: Session) -> None:
    """Sample chats for the demo account only: "General", a project channel and a direct message."""
    if db.scalar(select(ChatChannel.id).limit(1)) is not None:
        return
    users = _sample_people(db)
    me = users.get(DEFAULT_USER_EMAIL)
    if me is None:
        return
    by_name = {u.name: u for u in users.values()}
    priya, daniel, sara = by_name.get("Priya Sharma"), by_name.get("Daniel Kim"), by_name.get("Sara Lopez")
    now = utcnow()

    def channel(name, members, is_default=False, is_direct=False):
        c = ChatChannel(name=name, is_default=is_default, is_direct=is_direct, created_by=me.id)
        c.members = [ChannelMember(user_id=u.id) for u in members if u]
        db.add(c)
        db.flush()
        return c

    def say(c, user, text, minutes_ago):
        if user:
            db.add(ChannelMessage(channel_id=c.id, user_id=user.id, content=text, created_at=now - timedelta(minutes=minutes_ago)))

    general = channel("General", list(users.values()), is_default=True)
    say(general, priya, "Good morning everyone! Standup is at 10.", 180)
    say(general, daniel, "Thanks Priya. I'll share the dashboard mockups there.", 175)
    say(general, me, "Sounds good, see you all soon.", 170)

    project = channel("Dashboard v2", [me, priya, daniel])
    say(project, daniel, "First draft of the new dashboard is in Docs.", 90)
    say(project, priya, "Looks great. Can we review it in the design meeting?", 60)

    dm = channel(None, [me, priya], is_direct=True)
    say(dm, priya, "Hey Alex, do you have a minute before our 1:1?", 30)
    say(dm, me, "Sure, call me after lunch.", 25)
    if sara:
        say(general, sara, "Reminder: the client demo is on Monday.", 15)
    db.commit()


def keep_sample_chats_private(db: Session) -> None:
    """Older versions put every new account in the sample "General" channel.
    Take them out (with anything they posted there) so it stays a demo-only chat."""
    general = db.scalar(select(ChatChannel).where(ChatChannel.is_default.is_(True)))
    if general is None:
        return
    sample_ids = {u.id for u in _sample_people(db).values()}
    for member in list(general.members):
        if member.user_id not in sample_ids:
            db.delete(member)
    for message in db.scalars(select(ChannelMessage).where(ChannelMessage.channel_id == general.id)).all():
        if message.user_id not in sample_ids:
            db.delete(message)
    db.commit()


def seed_docs(db: Session) -> None:
    """A couple of documents for the demo account, one shared by a teammate."""
    if db.scalar(select(Document.id).limit(1)) is not None:
        return
    users = _seed_users(db)
    me = users.get(DEFAULT_USER_EMAIL)
    priya = next((u for u in users.values() if u.name == "Priya Sharma"), None)
    if me is None:
        return
    db.add(
        Document(
            owner_id=me.id,
            updated_by=me.id,
            title="Q4 Planning",
            content=(
                "Goals\n"
                "- Launch Dashboard v2\n"
                "- Cut page load time in half\n"
                "- Hire two frontend engineers\n\n"
                "Open questions\n"
                "- Do we need a beta period for the new dashboard?\n"
            ),
        )
    )
    if priya:
        shared = Document(
            owner_id=priya.id,
            updated_by=priya.id,
            title="Design Review notes",
            content="Attendees: Priya, Alex, Daniel\n\nDecisions\n- Keep the blue header\n- Move filters to the left\n",
        )
        shared.members = [DocumentMember(user_id=me.id, can_edit=True)]
        db.add(shared)
    db.commit()
