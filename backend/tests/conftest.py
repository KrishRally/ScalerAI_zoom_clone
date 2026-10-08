import os
import tempfile

# Point the app at a throwaway database before it is imported.
_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_db_file.name}"
os.environ["FRONTEND_URL"] = "http://testserver-frontend"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # "with" runs startup, which creates tables and seeds
        yield c
