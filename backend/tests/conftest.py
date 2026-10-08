import os
import tempfile

# Point the app at a throwaway database before it is imported.
_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_db_file.name}"
os.environ["FRONTEND_URL"] = "http://testserver-frontend"
os.environ["PASSWORD_HASH_ITERATIONS"] = "1000"  # fast hashing for tests only

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import DEFAULT_USER_EMAIL  # noqa: E402

DEMO_PASSWORD = "zoomdemo123"


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # "with" runs startup, which creates tables and seeds
        yield c


@pytest.fixture(scope="session")
def auth(client):
    """Headers for the signed in demo user."""
    res = client.post("/api/auth/login", json={"email": DEFAULT_USER_EMAIL, "password": DEMO_PASSWORD})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}
