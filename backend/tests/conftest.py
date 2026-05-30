"""
Shared test fixtures.
All env vars are set before any app module is imported — pydantic-settings
reads them at import time, so this must run before `from main import app`.
"""
import os
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from cryptography.fernet import Fernet

# ── Inject env vars before app imports ───────────────────────────────────────

TEST_USER_ID = uuid4()
TEST_FERNET_KEY = Fernet.generate_key().decode()

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "super-secret-test-jwt-key-32chars!!")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
os.environ.setdefault("FERNET_SECRET", TEST_FERNET_KEY)
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

# ── App + dependency imports (after env vars are set) ────────────────────────

from unittest.mock import patch

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from main import app


def make_mock_db():
    """Return a mock asyncpg Connection with the methods used in routers."""
    db = AsyncMock()
    db.fetch = AsyncMock(return_value=[])
    db.fetchrow = AsyncMock(return_value=None)
    db.fetchval = AsyncMock(return_value=0)
    db.execute = AsyncMock(return_value="DELETE 0")
    # transaction() must be an async context manager
    db.transaction = AsyncMock(return_value=AsyncMock(__aenter__=AsyncMock(), __aexit__=AsyncMock(return_value=False)))
    return db


@pytest.fixture
def mock_db():
    return make_mock_db()


@pytest.fixture
def test_user():
    return CurrentUser(id=TEST_USER_ID, email="test@learnos.app")


@pytest.fixture
def client(mock_db, test_user):
    """
    FastAPI TestClient with get_db and get_current_user overridden.
    No real database or JWT needed.
    """
    from fastapi.testclient import TestClient

    async def _override_db():
        yield mock_db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = lambda: test_user

    # Patch at the point of use: main.py imports init_pool/close_pool by name
    with patch("main.init_pool", new_callable=AsyncMock), \
         patch("main.close_pool", new_callable=AsyncMock):
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c

    app.dependency_overrides.clear()
