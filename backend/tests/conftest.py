"""
Pytest fixtures for lifty backend integration tests.

Strategy
--------
* Replace the production SQLite engine with a fresh in-memory engine for
  every test function – guarantees full isolation with zero disk I/O.
* Patch the engine reference in every module that holds a copy (main, db,
  seed_exercises) before the FastAPI TestClient is constructed so that the
  startup event also runs against the test engine.
* Create the schema via SQLModel.metadata.create_all before the TestClient
  starts – columns are created from the *current* Python models, so the
  test database is always in the "fully migrated" state.  This is exactly
  the class of bug we want to catch: if a column is used in a query but
  missing from the model (or vice-versa) the test will blow up immediately.
"""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine
from sqlalchemy.pool import StaticPool

import backend.main as app_module
import backend.db as db_module
import backend.seed_exercises as seed_module


def _make_test_client(monkeypatch):
    """Shared helper: spin up an in-memory TestClient."""
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    monkeypatch.setattr(app_module, "engine", test_engine)
    monkeypatch.setattr(db_module, "engine", test_engine)
    monkeypatch.setattr(seed_module, "engine", test_engine)
    SQLModel.metadata.create_all(test_engine)
    return test_engine


@pytest.fixture()
def client(monkeypatch):
    """Return a TestClient backed by a fresh in-memory SQLite database.

    StaticPool is required so that every SQLAlchemy connection (even those
    opened by the FastAPI request handlers) lands on the *same* underlying
    sqlite3 connection.  Without it each new connection gets a fresh,
    empty :memory: database and every query fails with "no such table".
    """
    _make_test_client(monkeypatch)

    with TestClient(app_module.app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture()
def auth_client(monkeypatch):
    """TestClient with instance auth enabled (LIFTY_PASSWORD=testpass).

    Yields (client, token) — the token is pre-obtained so tests can call
    protected routes without repeating the login step.
    """
    monkeypatch.setenv("LIFTY_PASSWORD", "testpass")
    _make_test_client(monkeypatch)

    with TestClient(app_module.app, raise_server_exceptions=True) as c:
        r = c.post("/api/auth/login", json={"password": "testpass"})
        assert r.status_code == 200, f"Login failed: {r.text}"
        token = r.json()["token"]
        yield c, token

    # Reset module-level auth state so subsequent tests start clean
    app_module._auth_state.update({"enabled": False, "jwt_secret": "dev-only", "password_hash": None})
