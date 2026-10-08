"""Meeting ID, passcode and invite link helpers."""

import re
import secrets
import string

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import FRONTEND_URL
from app.models import Meeting

_PASSCODE_ALPHABET = string.ascii_letters + string.digits


def generate_meeting_code(db: Session) -> str:
    """Random 10 digit Meeting ID that is not already used.

    The first digit is never 0 so the ID always has 10 digits.
    With 9 billion possible IDs a clash is very rare, but we still check.
    """
    while True:
        code = str(secrets.randbelow(9_000_000_000) + 1_000_000_000)
        exists = db.scalar(select(Meeting.id).where(Meeting.meeting_code == code))
        if not exists:
            return code


def generate_passcode(length: int = 6) -> str:
    return "".join(secrets.choice(_PASSCODE_ALPHABET) for _ in range(length))


def generate_personal_meeting_id() -> str:
    return str(secrets.randbelow(9_000_000_000) + 1_000_000_000)


def build_invite_link(meeting_code: str, passcode: str) -> str:
    return f"{FRONTEND_URL}/j/{meeting_code}?pwd={passcode}"


_LINK_CODE = re.compile(r"/j/(\d{9,11})")


def normalize_meeting_code(raw: str) -> str:
    """Turn what a user typed into a bare Meeting ID.

    Accepts "845 2391 0476", "845-2391-0476", "84523910476"
    or a full invite link like "https://site/j/84523910476?pwd=abc".
    Returns "" if nothing usable was found.
    """
    raw = raw.strip()
    match = _LINK_CODE.search(raw)
    if match:
        return match.group(1)
    return re.sub(r"[\s-]", "", raw) if re.fullmatch(r"[\d\s-]+", raw) else ""
