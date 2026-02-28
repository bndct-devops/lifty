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


@pytest.fixture()
def client(monkeypatch):
    """Return a TestClient backed by a fresh in-memory SQLite database.

    StaticPool is required so that every SQLAlchemy connection (even those
    opened by the FastAPI request handlers) lands on the *same* underlying
    sqlite3 connection.  Without it each new connection gets a fresh,
    empty :memory: database and every query fails with "no such table".
    """
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Redirect every cached engine reference to the test engine.
    monkeypatch.setattr(app_module, "engine", test_engine)
    monkeypatch.setattr(db_module, "engine", test_engine)
    monkeypatch.setattr(seed_module, "engine", test_engine)

    # Build the schema from the current models (all columns, no migrations needed).
    SQLModel.metadata.create_all(test_engine)

    # Using the context manager triggers FastAPI startup/shutdown events.
    # Startup will re-run create_db_and_tables (no-op) + migrations (no-op,
    # columns already exist) + seed exercises – all against the test engine.
    with TestClient(app_module.app, raise_server_exceptions=True) as c:
        yield c
