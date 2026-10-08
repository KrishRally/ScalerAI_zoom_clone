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

from app.config import DEMO_PASSWORD
from app.models import (
    ChatMessage,
    Meeting,
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
from app.services.security import hash_password

DEFAULT_USER_EMAIL = "alex.johnson@example.com"
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

    for title, description, starts_in, duration in _UPCOMING:
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
                scheduled_start=(now + starts_in).replace(
                    minute=0 if (now + starts_in).minute < 30 else 30,
                    second=0,
                    microsecond=0,
                ),
                duration_minutes=duration,
            )
        )
        db.flush()

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
