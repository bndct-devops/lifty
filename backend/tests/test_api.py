"""
Integration tests for the lifty backend API.

Tests are arranged from basic sanity → full workout lifecycle → analytics,
mirroring the real app flow.  Every test runs against a fresh in-memory
SQLite database so there is no shared state between tests.

Regression coverage
-------------------
* POST /api/workouts/{id}/sets   – was returning 500 (SetOut.order required,
                                   SetEntry had no order column → schema crash)
* GET  /api/workouts/{id}        – was returning 500 (order_by(SetEntry.order)
                                   on non-existent column → SQLite crash)
* GET  /api/exercises/{id}/last_sets – same order_by crash
* GET  /api/exercises/{id}/history   – unrelated order_by, but exercised here
"""

from __future__ import annotations

import pytest


# ─── helpers ───────────────────────────────────────────────────────────────────

def _make_profile(client, name: str = "Mia") -> int:
    r = client.post("/api/profiles", json={"name": name, "unit": "kg", "theme": "dark"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _make_exercise(client, profile_id: int, name: str = "Bench Press") -> int:
    r = client.post(
        "/api/exercises",
        json={"name": name, "body_part": "Chest", "equipment": "Barbell",
              "profile_id": profile_id},
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _make_workout(client, profile_id: int, name: str = "Push Day") -> int:
    r = client.post("/api/workouts", json={"name": name, "profile_id": profile_id})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _start_workout(client, workout_id: int) -> dict:
    r = client.post(f"/api/workouts/{workout_id}/start")
    assert r.status_code == 200, r.text
    return r.json()


def _finish_workout(client, workout_id: int) -> dict:
    r = client.post(f"/api/workouts/{workout_id}/finish")
    assert r.status_code == 200, r.text
    return r.json()


def _add_set(client, workout_id: int, exercise_id: int,
             reps: int = 8, weight: float = 80.0) -> dict:
    r = client.post(
        f"/api/workouts/{workout_id}/sets",
        json={"exercise_id": exercise_id, "reps": reps, "weight": weight},
    )
    assert r.status_code == 200, r.text
    return r.json()


# ─── basic sanity ──────────────────────────────────────────────────────────────

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ─── profiles ──────────────────────────────────────────────────────────────────

def test_create_profile(client):
    profile_id = _make_profile(client, "Alice")
    assert isinstance(profile_id, int)
    assert profile_id > 0


def test_list_profiles_contains_created(client):
    _make_profile(client, "Bob")
    r = client.get("/api/profiles")
    assert r.status_code == 200
    names = [p["name"] for p in r.json()]
    assert "Bob" in names


# ─── exercises ─────────────────────────────────────────────────────────────────

def test_create_exercise(client):
    pid = _make_profile(client)
    eid = _make_exercise(client, pid, "Squat")
    assert isinstance(eid, int)
    assert eid > 0


def test_list_exercises_returns_seeded_globals(client):
    """Startup seeds global exercises – they should always appear."""
    r = client.get("/api/exercises")
    assert r.status_code == 200
    names = [e["name"] for e in r.json()]
    assert "Bench Press" in names  # seeded in seed_exercises.py


# ─── workout lifecycle (critical regression path) ──────────────────────────────

def test_create_workout(client):
    pid = _make_profile(client)
    wid = _make_workout(client, pid)
    assert isinstance(wid, int)
    assert wid > 0


def test_start_workout(client):
    pid = _make_profile(client)
    wid = _make_workout(client, pid)
    data = _start_workout(client, wid)
    assert data["status"] == "in_progress"
    assert data["start_time"] is not None


def test_add_set_returns_set_out(client):
    """
    Regression: POST /api/workouts/{id}/sets was returning 500 because
    SetOut.order was declared required (int) but the DB column did not exist,
    causing a validation error on every response.
    """
    pid = _make_profile(client)
    eid = _make_exercise(client, pid)
    wid = _make_workout(client, pid)
    _start_workout(client, wid)

    s = _add_set(client, wid, eid, reps=10, weight=100.0)

    # Core shape
    assert s["id"] > 0
    assert s["workout_id"] == wid
    assert s["exercise_id"] == eid
    assert s["reps"] == 10
    assert s["weight"] == 100.0
    # These were the problematic optional fields – must not blow up
    assert "order" in s      # present, may be None or int
    assert "timestamp" in s  # present, may be None or ISO string


def test_get_workout_detail_with_sets(client):
    """
    Regression: GET /api/workouts/{id} was returning 500 because the query
    used .order_by(SetEntry.order) on a column that didn't exist in the DB.
    This endpoint powers the "Continue workout" button.
    """
    pid = _make_profile(client)
    eid = _make_exercise(client, pid)
    wid = _make_workout(client, pid)
    _start_workout(client, wid)
    _add_set(client, wid, eid, reps=5, weight=60.0)
    _add_set(client, wid, eid, reps=5, weight=60.0)

    r = client.get(f"/api/workouts/{wid}")
    assert r.status_code == 200, r.text

    detail = r.json()
    assert "workout" in detail
    assert "sets" in detail
    assert len(detail["sets"]) == 2
    assert detail["workout"]["set_count"] == 2


def test_get_workout_detail_404_for_missing(client):
    r = client.get("/api/workouts/999999")
    assert r.status_code == 404


def test_finish_workout(client):
    pid = _make_profile(client)
    wid = _make_workout(client, pid)
    _start_workout(client, wid)
    data = _finish_workout(client, wid)
    assert data["status"] == "finished"
    assert data["end_time"] is not None


def test_delete_set(client):
    pid = _make_profile(client)
    eid = _make_exercise(client, pid)
    wid = _make_workout(client, pid)
    _start_workout(client, wid)
    s = _add_set(client, wid, eid)

    r = client.delete(f"/api/workouts/{wid}/sets/{s['id']}")
    assert r.status_code == 204

    detail = client.get(f"/api/workouts/{wid}").json()
    assert len(detail["sets"]) == 0


# ─── exercise history & last-sets (critical regression path) ───────────────────

def _seed_finished_workout(client, pid: int, eid: int,
                            reps: int = 8, weight: float = 80.0) -> int:
    """Create + start + add one set + finish – returns workout_id."""
    wid = _make_workout(client, pid)
    _start_workout(client, wid)
    _add_set(client, wid, eid, reps=reps, weight=weight)
    _finish_workout(client, wid)
    return wid


def test_exercise_last_sets_after_finished_workout(client):
    """
    Regression: GET /api/exercises/{id}/last_sets was crashing with the same
    order_by(SetEntry.order) bug.  The app calls this to pre-fill the weight/
    reps inputs when the user opens an exercise during an active session.
    """
    pid = _make_profile(client)
    eid = _make_exercise(client, pid)
    _seed_finished_workout(client, pid, eid, reps=6, weight=90.0)

    r = client.get(f"/api/exercises/{eid}/last_sets?profile_id={pid}")
    assert r.status_code == 200, r.text
    sets = r.json()
    assert len(sets) == 1
    assert sets[0]["reps"] == 6
    assert sets[0]["weight"] == 90.0


def test_exercise_last_sets_empty_for_no_history(client):
    """Should return [] rather than 500 when no finished workouts exist."""
    pid = _make_profile(client)
    eid = _make_exercise(client, pid)
    r = client.get(f"/api/exercises/{eid}/last_sets?profile_id={pid}")
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_exercise_history(client):
    """
    GET /api/exercises/{id}/history is used for the in-app progress chart.
    Must return a list with date, max_weight_kg, sets_count, e1rm_kg.
    """
    pid = _make_profile(client)
    eid = _make_exercise(client, pid)
    _seed_finished_workout(client, pid, eid, reps=5, weight=100.0)
    _seed_finished_workout(client, pid, eid, reps=5, weight=105.0)

    r = client.get(f"/api/exercises/{eid}/history?profile_id={pid}")
    assert r.status_code == 200, r.text
    history = r.json()
    assert len(history) >= 1
    entry = history[-1]
    assert "date" in entry
    assert "max_weight_kg" in entry
    assert "sets_count" in entry
    assert "e1rm_kg" in entry


# ─── analytics ─────────────────────────────────────────────────────────────────

def test_daily_volume(client):
    pid = _make_profile(client)
    eid = _make_exercise(client, pid)
    _seed_finished_workout(client, pid, eid)

    r = client.get(f"/api/analytics/daily-volume?profile_id={pid}")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 7  # Mon–Sun
    assert all("day" in d for d in data)


def test_list_workouts(client):
    pid = _make_profile(client)
    _make_workout(client, pid, "Leg Day")
    r = client.get(f"/api/workouts?profile_id={pid}")
    assert r.status_code == 200
    names = [w["name"] for w in r.json()]
    assert "Leg Day" in names
