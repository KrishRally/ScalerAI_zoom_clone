"""App settings, read from environment variables so the same code runs locally and on Railway."""

import os

# Where the SQLite file lives. On Railway we point this at a mounted volume
# (for example sqlite:////data/zoom.db) so data survives restarts.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./zoom.db")

# Public address of the frontend. Used to build shareable invite links.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

# Comma separated list of sites allowed to call the API from a browser (CORS).
CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

# Also allow Vercel preview deployments (https://<anything>.vercel.app).
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app")

# A participant who has not checked in for this many seconds is treated as gone
# (for example they closed the tab without clicking Leave).
PARTICIPANT_TIMEOUT_SECONDS = int(os.getenv("PARTICIPANT_TIMEOUT_SECONDS", "30"))

# Password hashing strength (PBKDF2 rounds). Tests lower this to stay fast.
PASSWORD_HASH_ITERATIONS = int(os.getenv("PASSWORD_HASH_ITERATIONS", "600000"))

# How long a sign in lasts before the user must sign in again.
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "30"))

# The seeded demo account. Team Chat is only turned on for this account.
DEMO_EMAIL = "alex.johnson@example.com"

# Password for the seeded demo account, so reviewers can sign in straight away.
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "zoomdemo123")
