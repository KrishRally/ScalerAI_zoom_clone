"""Password hashing and random tokens, using only Python's standard library."""

import base64
import hashlib
import hmac
import secrets

from app.config import PASSWORD_HASH_ITERATIONS

_ALGORITHM = "pbkdf2_sha256"


def hash_password(password: str) -> str:
    """Salted PBKDF2-SHA256. Stored as "pbkdf2_sha256$rounds$salt$hash".

    The random salt means two people with the same password get different hashes,
    and the many rounds make guessing passwords slow.
    """
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PASSWORD_HASH_ITERATIONS)
    return "$".join(
        [
            _ALGORITHM,
            str(PASSWORD_HASH_ITERATIONS),
            base64.b64encode(salt).decode(),
            base64.b64encode(digest).decode(),
        ]
    )


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algorithm, rounds, salt_b64, digest_b64 = stored.split("$")
    except ValueError:
        return False
    if algorithm != _ALGORITHM:
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), base64.b64decode(salt_b64), int(rounds)
    )
    # compare_digest takes the same time whether or not the hashes match.
    return hmac.compare_digest(digest, base64.b64decode(digest_b64))


def new_token() -> tuple[str, str]:
    """A random token to give to the browser, and the hash we store instead."""
    token = secrets.token_urlsafe(32)
    return token, hash_token(token)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
