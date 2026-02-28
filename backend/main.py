from fastapi import FastAPI, Response, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from sqlmodel import Session, select, text, or_
from backend.db import engine, create_db_and_tables
from backend.models import Exercise, Workout, SetEntry, Profile, BodyweightEntry
from backend import schemas
from backend.seed_exercises import seed as seed_exercises
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Counter
from typing import List, Optional
from datetime import datetime, timedelta
import io, csv, re, hashlib, os as _os, time as _time
import uvicorn

# ── Rate limiting for profile password verification ──
_pw_attempts: dict = {}   # profile_id -> {"count": int, "locked_until": float}
_PW_MAX_ATTEMPTS = 5
_PW_LOCKOUT_SECS = 30

app = FastAPI(title="lifty API")

REQUEST_COUNTER = Counter("lifty_requests_total", "Total HTTP requests", ["method", "endpoint", "status"])


@app.on_event("startup")
def on_startup():
    create_db_and_tables()

    # ── Schema migration: add profile_id columns if they don't exist yet ──
    with Session(engine) as session:
        for ddl in [
            "ALTER TABLE exercise ADD COLUMN profile_id INTEGER REFERENCES profile(id)",
            "ALTER TABLE workout ADD COLUMN profile_id INTEGER REFERENCES profile(id)",
            "ALTER TABLE workout ADD COLUMN notes TEXT",
            "ALTER TABLE workout ADD COLUMN is_rest_day INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE profile ADD COLUMN rest_duration INTEGER NOT NULL DEFAULT 90",
            "ALTER TABLE profile ADD COLUMN week_start TEXT NOT NULL DEFAULT 'monday'",
            "ALTER TABLE profile ADD COLUMN avatar_color TEXT NOT NULL DEFAULT '#60a5fa'",
            "ALTER TABLE profile ADD COLUMN ding_enabled INTEGER NOT NULL DEFAULT 1",
        ]:
            try:
                session.exec(text(ddl))
                session.commit()
            except Exception:
                pass  # column already exists

        # ── Create default profile if none exists; migrate orphaned workouts ──
        existing_profile = session.exec(select(Profile)).first()
        if not existing_profile:
            profile = Profile(name="benedict", unit="kg", theme="dark")
            session.add(profile)
            session.commit()
            session.refresh(profile)
            session.exec(text(f"UPDATE workout SET profile_id = {profile.id} WHERE profile_id IS NULL"))
            session.commit()
        else:
            # Assign any remaining orphaned workouts to the first profile
            session.exec(text(f"UPDATE workout SET profile_id = {existing_profile.id} WHERE profile_id IS NULL"))
            session.commit()

    # ── Seed built-in global exercises (idempotent) ──
    seed_exercises()


# ─────────────────────────────────────────────
# Utility
# ─────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ─────────────────────────────────────────────
# Profiles
# ─────────────────────────────────────────────

def _hash_pin(pin: str) -> str:
    salt = _os.urandom(16)
    dk = hashlib.pbkdf2_hmac('sha256', pin.encode(), salt, 100_000)
    return salt.hex() + ':' + dk.hex()

def _verify_pin(pin: str, stored: str) -> bool:
    try:
        salt_hex, dk_hex = stored.split(':', 1)
        dk = hashlib.pbkdf2_hmac('sha256', pin.encode(), bytes.fromhex(salt_hex), 100_000)
        return dk.hex() == dk_hex
    except Exception:
        return False

def _profile_out(p) -> dict:
    return {
        'id': p.id, 'name': p.name, 'unit': p.unit, 'theme': p.theme,
        'rest_duration': p.rest_duration, 'week_start': p.week_start,
        'avatar_color': p.avatar_color, 'ding_enabled': p.ding_enabled,
        'has_pin': p.pin_hash is not None, 'created_at': p.created_at,
    }

@app.get("/api/profiles", response_model=List[schemas.ProfileOut])
def list_profiles():
    with Session(engine) as session:
        profiles = session.exec(select(Profile).order_by(Profile.created_at)).all()
    return [_profile_out(p) for p in profiles]


@app.post("/api/profiles", response_model=schemas.ProfileOut, status_code=201)
def create_profile(data: schemas.ProfileCreate):
    with Session(engine) as session:
        p = Profile(name=data.name.strip(), unit=data.unit, theme=data.theme)
        session.add(p)
        session.commit()
        session.refresh(p)
    return _profile_out(p)


@app.get("/api/profiles/{profile_id}", response_model=schemas.ProfileOut)
def get_profile(profile_id: int):
    with Session(engine) as session:
        p = session.get(Profile, profile_id)
        if not p:
            return Response(status_code=404)
    return _profile_out(p)


@app.patch("/api/profiles/{profile_id}", response_model=schemas.ProfileOut)
def update_profile(profile_id: int, data: schemas.ProfileUpdate):
    with Session(engine) as session:
        p = session.get(Profile, profile_id)
        if not p:
            return Response(status_code=404)
        if data.name is not None:
            p.name = data.name.strip()
        if data.unit is not None and data.unit in ("kg", "lbs"):
            p.unit = data.unit
        if data.theme is not None:
            p.theme = data.theme
        if data.rest_duration is not None:
            p.rest_duration = data.rest_duration
        if data.week_start is not None and data.week_start in ("monday", "sunday"):
            p.week_start = data.week_start
        if data.avatar_color is not None:
            p.avatar_color = data.avatar_color
        if data.ding_enabled is not None:
            p.ding_enabled = data.ding_enabled
        session.add(p)
        session.commit()
        session.refresh(p)
    return _profile_out(p)


@app.delete("/api/profiles/{profile_id}", status_code=204)
def delete_profile(profile_id: int):
    with Session(engine) as session:
        all_profiles = session.exec(select(Profile)).all()
        if len(all_profiles) <= 1:
            return Response(status_code=400)  # can't delete last profile
        p = session.get(Profile, profile_id)
        if not p:
            return Response(status_code=404)
        # cascade delete workouts+sets and exercises
        workouts = session.exec(select(Workout).where(Workout.profile_id == profile_id)).all()
        for w in workouts:
            for s in session.exec(select(SetEntry).where(SetEntry.workout_id == w.id)).all():
                session.delete(s)
            session.delete(w)
        for ex in session.exec(select(Exercise).where(Exercise.profile_id == profile_id)).all():
            session.delete(ex)
        session.delete(p)
        session.commit()
    return Response(status_code=204)


@app.post("/api/profiles/{profile_id}/bodyweight", response_model=schemas.BodyweightOut, status_code=201)
def log_bodyweight(profile_id: int, data: schemas.BodyweightIn):
    with Session(engine) as session:
        p = session.get(Profile, profile_id)
        if not p:
            return Response(status_code=404)
        entry = BodyweightEntry(
            profile_id=profile_id,
            weight_kg=round(data.weight_kg, 3),
            date=data.date or datetime.utcnow(),
        )
        session.add(entry)
        session.commit()
        session.refresh(entry)
    return entry


@app.get("/api/profiles/{profile_id}/bodyweight", response_model=List[schemas.BodyweightOut])
def get_bodyweight(profile_id: int, limit: int = Query(default=90)):
    with Session(engine) as session:
        entries = session.exec(
            select(BodyweightEntry)
            .where(BodyweightEntry.profile_id == profile_id)
            .order_by(BodyweightEntry.date.asc())
            .limit(limit)
        ).all()
    return entries


@app.delete("/api/profiles/{profile_id}/bodyweight/{entry_id}", status_code=204)
def delete_bodyweight(profile_id: int, entry_id: int):
    with Session(engine) as session:
        entry = session.get(BodyweightEntry, entry_id)
        if not entry or entry.profile_id != profile_id:
            return Response(status_code=404)
        session.delete(entry)
        session.commit()
    return Response(status_code=204)


@app.post("/api/profiles/{profile_id}/set-pin", response_model=schemas.ProfileOut)
def set_profile_pin(profile_id: int, data: schemas.PinSet):
    with Session(engine) as session:
        p = session.get(Profile, profile_id)
        if not p:
            return Response(status_code=404)
        if data.pin:
            if not (4 <= len(data.pin.strip()) <= 64):
                return Response(status_code=422)
            p.pin_hash = _hash_pin(data.pin)
        else:
            p.pin_hash = None
            _pw_attempts.pop(profile_id, None)  # clear lockout on password removal
        session.add(p)
        session.commit()
        session.refresh(p)
    return _profile_out(p)


@app.post("/api/profiles/{profile_id}/verify-pin")
def verify_profile_pin(profile_id: int, data: schemas.PinVerify):
    now = _time.time()
    rec = _pw_attempts.get(profile_id, {"count": 0, "locked_until": 0.0})
    if rec["locked_until"] > now:
        retry_after = int(rec["locked_until"] - now) + 1
        return JSONResponse({"ok": False, "locked": True, "retry_after": retry_after}, status_code=429)
    with Session(engine) as session:
        p = session.get(Profile, profile_id)
        if not p:
            return Response(status_code=404)
        if not p.pin_hash:
            return {"ok": True}
        if _verify_pin(data.pin, p.pin_hash):
            _pw_attempts.pop(profile_id, None)  # clear on success
            return {"ok": True}
        # wrong password — increment counter
        rec["count"] = rec.get("count", 0) + 1
        if rec["count"] >= _PW_MAX_ATTEMPTS:
            rec["locked_until"] = now + _PW_LOCKOUT_SECS
            rec["count"] = 0
        _pw_attempts[profile_id] = rec
        return {"ok": False, "locked": False}


_STRONG_BODY_PART = {
    # Chest
    "bench press - close grip (barbell)": "Chest",
    "bench press (barbell)": "Chest",
    "bench press (dumbbell)": "Chest",
    "chest dip": "Chest",
    "chest fly": "Chest",
    "chest fly (band)": "Chest",
    "chest fly (single)": "Chest",
    "chest fly (under)": "Chest",
    "chest press (machine)": "Chest",
    "incline bench press (dumbbell)": "Chest",
    "incline bench press (smith machine)": "Chest",
    "incline chest press (machine)": "Chest",
    "iso-lateral chest press (machine)": "Chest",
    # Back
    "bent over one arm row (dumbbell)": "Back",
    "bent over row (barbell)": "Back",
    "iso-lateral row (machine)": "Back",
    "lat pulldown - underhand (band)": "Back",
    "lat pulldown - wide grip (cable)": "Back",
    "lat pulldown (cable)": "Back",
    "lat pulldown (close grip)": "Back",
    "lat pulldown (machine)": "Back",
    "lat pulldown (single arm)": "Back",
    "pull up (assisted)": "Back",
    "pullover (dumbbell)": "Back",
    "pullover (machine)": "Back",
    "seated row (cable)": "Back",
    "t bar row": "Back",
    # Shoulders
    "face pull (cable)": "Shoulders",
    "front raise (band)": "Shoulders",
    "front raise (cable)": "Shoulders",
    "front raise (dumbbell)": "Shoulders",
    "front raise (plate)": "Shoulders",
    "lateral raise (cable)": "Shoulders",
    "lateral raise (dumbbell)": "Shoulders",
    "lateral raise (machine)": "Shoulders",
    "overhead press (barbell)": "Shoulders",
    "overhead press (smith machine)": "Shoulders",
    "reverse fly (cable)": "Shoulders",
    "reverse fly (machine)": "Shoulders",
    "seated overhead press (dumbbell)": "Shoulders",
    "shoulder press (plate loaded)": "Shoulders",
    "shrug (dumbbell)": "Shoulders",
    "shrug (smith machine)": "Shoulders",
    # Arms
    "bench dip": "Arms",
    "bicep curl (barbell)": "Arms",
    "bicep curl (cable)": "Arms",
    "bicep curl (dumbbell)": "Arms",
    "bicep curl (machine)": "Arms",
    "cable kickback": "Arms",
    "dip machine": "Arms",
    "hammer curl (cable)": "Arms",
    "hammer curl (dumbbell)": "Arms",
    "incline curl (dumbbell)": "Arms",
    "preacher curl (barbell)": "Arms",
    "preacher curl (dumbbell)": "Arms",
    "preacher curl (machine)": "Arms",
    "reverse curl (barbell)": "Arms",
    "reverse curl (cable)": "Arms",
    "reverse curl (dumbbell)": "Arms",
    "single biceps curl (cable)": "Arms",
    "single triceps extension (cable)": "Arms",
    "skullcrusher (barbell)": "Arms",
    "skullcrusher (dumbbell)": "Arms",
    "triceps dip (assisted)": "Arms",
    "triceps extension": "Arms",
    "triceps extension (cable)": "Arms",
    "triceps extension (dumbbell)": "Arms",
    "triceps extension (machine)": "Arms",
    "triceps pushdown (cable - straight bar)": "Arms",
    # Legs
    "bulgarian split squat  (leg press)": "Legs",
    "hack squat": "Legs",
    "leg extension (machine)": "Legs",
    "leg press": "Legs",
    "lying leg curl (machine)": "Legs",
    "romanian deadlift (barbell)": "Legs",
    "seated leg press (machine)": "Legs",
    "squat (barbell)": "Legs",
    "standing calf raise (machine)": "Legs",
    "standing leg curl (machine)": "Legs",
    # Other
    "stretching": "Other",
}

_STRONG_EQUIPMENT = {
    "barbell": "Barbell", "dumbbell": "Dumbbell", "cable": "Cable",
    "machine": "Machine", "band": "Band", "smith machine": "Smith Machine",
    "plate": "Plate", "assisted": "Machine",
}

def _guess_equipment(name: str) -> str | None:
    low = name.lower()
    for keyword, eq in _STRONG_EQUIPMENT.items():
        if keyword in low:
            return eq
    return None


@app.post("/api/import/strong")
async def import_strong(file: UploadFile = File(...), profile_id: int = Form(...)):
    contents = await file.read()
    text_data = contents.decode("utf-8-sig")  # handle BOM if present
    reader = csv.DictReader(io.StringIO(text_data))

    def parse_duration(s):
        h = re.search(r'(\d+)h', s or '')
        m = re.search(r'(\d+)m', s or '')
        return (int(h.group(1)) * 60 if h else 0) + (int(m.group(1)) if m else 0)

    # Group rows by (date_str, workout_name)
    from collections import OrderedDict
    workouts_map = OrderedDict()
    for row in reader:
        key = (row['Date'].strip(), row['Workout Name'].strip())
        workouts_map.setdefault(key, []).append(row)

    with Session(engine) as session:
        # Build exercise name → id cache for this profile
        ex_cache = {}
        for ex in session.exec(select(Exercise).where(
                (Exercise.profile_id == profile_id) | (Exercise.profile_id == None)  # noqa
        )).all():
            ex_cache[ex.name.lower()] = ex.id

        # Existing workout start_times for this profile (to skip dupes)
        existing_starts = set(
            w.start_time.isoformat()[:19] if w.start_time else None
            for w in session.exec(select(Workout).where(Workout.profile_id == profile_id)).all()
        )
        existing_starts.discard(None)

        imported = 0
        skipped = 0
        created_exercises = 0
        imported_sets = 0

        for (date_str, workout_name), rows in workouts_map.items():
            dt = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
            dt_key = dt.isoformat()[:19]
            if dt_key in existing_starts:
                skipped += 1
                continue

            duration_mins = parse_duration(rows[0].get('Duration', ''))
            end_dt = dt + timedelta(minutes=duration_mins) if duration_mins else None

            w = Workout(name=workout_name, date=dt, start_time=dt, end_time=end_dt,
                        status='finished', profile_id=profile_id)
            session.add(w)
            session.flush()  # get w.id

            for order, row in enumerate(rows, 1):
                ex_name = row['Exercise Name'].strip()
                if not ex_name:
                    continue  # skip rest timer rows and other blanks
                ex_key = ex_name.lower()
                if ex_key not in ex_cache:
                    body_part = _STRONG_BODY_PART.get(ex_key)
                    equipment = _guess_equipment(ex_name)
                    new_ex = Exercise(name=ex_name, profile_id=profile_id,
                                      body_part=body_part, equipment=equipment)
                    session.add(new_ex)
                    session.flush()
                    ex_cache[ex_key] = new_ex.id
                    created_exercises += 1

                try:
                    weight = float(row.get('Weight') or 0) or None
                    reps = int(float(row.get('Reps') or 0)) or None
                except (ValueError, TypeError):
                    weight, reps = None, None

                # Skip rows with no meaningful data (rest timers, blank placeholders)
                if weight is None and reps is None:
                    continue

                s = SetEntry(workout_id=w.id, exercise_id=ex_cache[ex_key],
                             weight=weight, reps=reps, order=order)
                session.add(s)
                imported_sets += 1

            existing_starts.add(dt_key)
            imported += 1

        session.commit()

    return {
        "imported_workouts": imported,
        "skipped_workouts": skipped,
        "created_exercises": created_exercises,
        "imported_sets": imported_sets,
    }


@app.get("/api/profiles/{profile_id}/export.csv")
def export_profile_csv(profile_id: int):
    with Session(engine) as session:
        p = session.get(Profile, profile_id)
        if not p:
            return Response(status_code=404)
        exercises = {e.id: e for e in session.exec(select(Exercise).where(
            or_(Exercise.profile_id == profile_id, Exercise.profile_id == None)
        )).all()}
        workouts = session.exec(select(Workout).where(Workout.profile_id == profile_id).order_by(Workout.date)).all()
        all_sets = session.exec(select(SetEntry)).all()
        sets_by_workout = {}
        for s in all_sets:
            sets_by_workout.setdefault(s.workout_id, []).append(s)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["workout_id", "workout_name", "date", "status", "exercise", "body_part", "equipment", "set_num", "reps", "weight_kg"])
    for w in workouts:
        sets = sorted(sets_by_workout.get(w.id, []), key=lambda s: s.order)
        if not sets:
            writer.writerow([w.id, w.name, w.date.date(), w.status, "", "", "", "", "", ""])
        for i, s in enumerate(sets, 1):
            ex = exercises.get(s.exercise_id)
            writer.writerow([w.id, w.name, w.date.date(), w.status,
                             ex.name if ex else "", ex.body_part if ex else "", ex.equipment if ex else "",
                             i, s.reps or "", s.weight or ""])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=lifty_{p.name.lower()}_export.csv"}
    )


# ─────────────────────────────────────────────
# Exercises
# ─────────────────────────────────────────────

@app.post("/api/exercises", response_model=Exercise)
def create_exercise(ex: schemas.ExerciseCreate):
    with Session(engine) as session:
        db_ex = Exercise(name=ex.name, description=ex.description, body_part=ex.body_part,
                         equipment=ex.equipment, profile_id=ex.profile_id)
        session.add(db_ex)
        session.commit()
        session.refresh(db_ex)
    REQUEST_COUNTER.labels(method="POST", endpoint="/api/exercises", status="201").inc()
    return db_ex


@app.get("/api/exercises", response_model=List[Exercise])
def list_exercises(profile_id: Optional[int] = Query(default=None)):
    with Session(engine) as session:
        q = select(Exercise)
        if profile_id is not None:
            # include global (profile_id IS NULL) + profile-specific exercises
            q = q.where(or_(Exercise.profile_id == profile_id, Exercise.profile_id == None))
        exs = session.exec(q).all()
    REQUEST_COUNTER.labels(method="GET", endpoint="/api/exercises", status="200").inc()
    return exs


@app.get("/api/exercises/{exercise_id}/last_sets", response_model=List[schemas.SetOut])
def get_exercise_last_sets(exercise_id: int, profile_id: Optional[int] = Query(default=None)):
    with Session(engine) as session:
        q = (select(Workout)
             .join(SetEntry, SetEntry.workout_id == Workout.id)
             .where(SetEntry.exercise_id == exercise_id, Workout.status == "finished"))
        if profile_id is not None:
            q = q.where(Workout.profile_id == profile_id)
        w = session.exec(q.order_by(Workout.end_time.desc())).first()
        if not w:
            return []
        sets = session.exec(
            select(SetEntry)
            .where(SetEntry.workout_id == w.id, SetEntry.exercise_id == exercise_id)
            .order_by(SetEntry.order)
        ).all()
    REQUEST_COUNTER.labels(method="GET", endpoint="/api/exercises/{id}/last_sets", status="200").inc()
    return sets


@app.patch("/api/exercises/{exercise_id}", response_model=Exercise)
def update_exercise(exercise_id: int, ex_update: schemas.ExerciseUpdate):
    with Session(engine) as session:
        ex = session.get(Exercise, exercise_id)
        if not ex:
            return Response(status_code=404)
        if ex_update.name is not None:
            name = ex_update.name.strip()
            if name:
                ex.name = name
        if ex_update.description is not None:
            ex.description = ex_update.description or None
        if ex_update.body_part is not None:
            ex.body_part = ex_update.body_part or None
        if ex_update.equipment is not None:
            ex.equipment = ex_update.equipment or None
        session.add(ex)
        session.commit()
        session.refresh(ex)
    REQUEST_COUNTER.labels(method="PATCH", endpoint="/api/exercises/{id}", status="200").inc()
    return ex


# ─────────────────────────────────────────────
# Workouts
# ─────────────────────────────────────────────

@app.post("/api/workouts/rest-day", response_model=schemas.WorkoutOut)
def mark_rest_day(profile_id: int = Query(...)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    with Session(engine) as session:
        # Upsert: if a rest day already exists for today, return it
        existing = session.exec(
            select(Workout).where(
                Workout.profile_id == profile_id,
                Workout.is_rest_day == True,  # noqa
                Workout.date >= today,
            )
        ).first()
        if existing:
            return _workout_out(existing, [])
        w = Workout(name="Rest Day", date=today, status="finished",
                    is_rest_day=True, profile_id=profile_id)
        session.add(w)
        session.commit()
        session.refresh(w)
    return _workout_out(w, [])


@app.post("/api/workouts", response_model=schemas.WorkoutOut)
def create_workout(w: schemas.WorkoutCreate):
    with Session(engine) as session:
        w_db = Workout(name=w.name, profile_id=w.profile_id, **(dict(date=w.date) if w.date else {}))
        session.add(w_db)
        session.commit()
        session.refresh(w_db)
    REQUEST_COUNTER.labels(method="POST", endpoint="/api/workouts", status="201").inc()
    return _workout_out(w_db, [])


@app.post("/api/workouts/{workout_id}/start", response_model=schemas.WorkoutOut)
def start_workout(workout_id: int):
    with Session(engine) as session:
        w = session.get(Workout, workout_id)
        if not w:
            return Response(status_code=404)
        w.start_time = datetime.utcnow()
        w.status = "in_progress"
        session.add(w)
        session.commit()
        session.refresh(w)
        sets = session.exec(select(SetEntry).where(SetEntry.workout_id == workout_id)).all()
    REQUEST_COUNTER.labels(method="POST", endpoint="/api/workouts/{id}/start", status="200").inc()
    return _workout_out(w, sets)


@app.post("/api/workouts/{workout_id}/finish", response_model=schemas.WorkoutOut)
def finish_workout(workout_id: int):
    with Session(engine) as session:
        w = session.get(Workout, workout_id)
        if not w:
            return Response(status_code=404)
        w.end_time = datetime.utcnow()
        w.status = "finished"
        session.add(w)
        session.commit()
        session.refresh(w)
        sets = session.exec(select(SetEntry).where(SetEntry.workout_id == workout_id)).all()
    REQUEST_COUNTER.labels(method="POST", endpoint="/api/workouts/{id}/finish", status="200").inc()
    return _workout_out(w, sets)


@app.post("/api/workouts/{workout_id}/sets", response_model=schemas.SetOut)
def add_set(workout_id: int, set_entry: schemas.SetCreate):
    with Session(engine) as session:
        w = session.get(Workout, workout_id)
        if not w:
            return Response(status_code=404)
        s = SetEntry(workout_id=workout_id, exercise_id=set_entry.exercise_id,
                     reps=set_entry.reps, weight=set_entry.weight, order=set_entry.order)
        session.add(s)
        session.commit()
        session.refresh(s)
    REQUEST_COUNTER.labels(method="POST", endpoint="/api/workouts/{id}/sets", status="201").inc()
    return s


@app.delete("/api/workouts/{workout_id}/sets/{set_id}", status_code=204)
def delete_set(workout_id: int, set_id: int):
    with Session(engine) as session:
        s = session.get(SetEntry, set_id)
        if not s or s.workout_id != workout_id:
            return Response(status_code=404)
        session.delete(s)
        session.commit()
    REQUEST_COUNTER.labels(method="DELETE", endpoint="/api/workouts/{id}/sets/{set_id}", status="204").inc()
    return Response(status_code=204)


@app.patch("/api/workouts/{workout_id}", response_model=schemas.WorkoutOut)
def update_workout(workout_id: int, payload: schemas.WorkoutUpdate):
    with Session(engine) as session:
        w = session.get(Workout, workout_id)
        if not w:
            return Response(status_code=404)
        if payload.name is not None:
            w.name = payload.name.strip() or w.name
        if payload.notes is not None:
            w.notes = payload.notes
        if payload.is_rest_day is not None:
            w.is_rest_day = payload.is_rest_day
        session.add(w)
        session.commit()
        session.refresh(w)
        sets = session.exec(select(SetEntry).where(SetEntry.workout_id == workout_id)).all()
    return _workout_out(w, sets)


@app.delete("/api/profiles/{profile_id}/workouts", status_code=204)
def delete_all_workouts(profile_id: int):
    with Session(engine) as session:
        workouts = session.exec(select(Workout).where(Workout.profile_id == profile_id)).all()
        for w in workouts:
            for s in session.exec(select(SetEntry).where(SetEntry.workout_id == w.id)).all():
                session.delete(s)
            session.delete(w)
        session.commit()
    return Response(status_code=204)


@app.delete("/api/workouts/{workout_id}", status_code=204)
def delete_workout(workout_id: int):
    with Session(engine) as session:
        w = session.get(Workout, workout_id)
        if not w:
            return Response(status_code=404)
        for s in session.exec(select(SetEntry).where(SetEntry.workout_id == workout_id)).all():
            session.delete(s)
        session.delete(w)
        session.commit()
    return Response(status_code=204)


@app.patch("/api/workouts/{workout_id}/sets/{set_id}", response_model=schemas.SetOut)
def update_set(workout_id: int, set_id: int, set_update: schemas.SetUpdate):
    with Session(engine) as session:
        s = session.get(SetEntry, set_id)
        if not s or s.workout_id != workout_id:
            return Response(status_code=404)
        if set_update.reps is not None:
            s.reps = set_update.reps
        if set_update.weight is not None:
            s.weight = set_update.weight
        if set_update.order is not None:
            s.order = set_update.order
        session.add(s)
        session.commit()
        session.refresh(s)
    REQUEST_COUNTER.labels(method="PATCH", endpoint="/api/workouts/{id}/sets/{set_id}", status="200").inc()
    return s


@app.get("/api/workouts/{workout_id}", response_model=schemas.WorkoutDetail)
def get_workout_detail(workout_id: int):
    with Session(engine) as session:
        w = session.get(Workout, workout_id)
        if not w:
            return Response(status_code=404)
        sets = session.exec(select(SetEntry).where(SetEntry.workout_id == workout_id).order_by(SetEntry.order)).all()
    REQUEST_COUNTER.labels(method="GET", endpoint="/api/workouts/{id}", status="200").inc()
    return {"workout": _workout_out(w, sets), "sets": sets}


@app.get("/api/workouts", response_model=List[schemas.WorkoutOut])
def list_workouts(profile_id: Optional[int] = Query(default=None)):
    with Session(engine) as session:
        q = select(Workout)
        if profile_id is not None:
            q = q.where(Workout.profile_id == profile_id)
        ws = session.exec(q).all()
        result = []
        for w in ws:
            sets = session.exec(select(SetEntry).where(SetEntry.workout_id == w.id)).all()
            result.append(_workout_out(w, sets))
    REQUEST_COUNTER.labels(method="GET", endpoint="/api/workouts", status="200").inc()
    return result


# ─────────────────────────────────────────────
# Analytics
# ─────────────────────────────────────────────

@app.get("/api/analytics/daily-volume")
def get_daily_volume(profile_id: Optional[int] = Query(default=None)):
    """Set count and tonnage for each day of the current Mon–Sun week."""
    from datetime import date, timedelta
    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # Monday

    with Session(engine) as session:
        wo_q = select(Workout).where(Workout.status == "finished")
        if profile_id is not None:
            wo_q = wo_q.where(Workout.profile_id == profile_id)
        finished_workouts = {w.id: str(w.date)[:10] for w in session.exec(wo_q).all()}

        week_workout_ids = {
            wid for wid, d in finished_workouts.items()
            if d and date.fromisoformat(d) >= week_start and date.fromisoformat(d) < week_start + timedelta(weeks=1)
        }
        all_sets = session.exec(
            select(SetEntry).where(SetEntry.workout_id.in_(list(week_workout_ids)))
        ).all() if week_workout_ids else []

        # Build a map: date_str -> [sets]
        sets_by_date: dict = {}
        for s in all_sets:
            wo_date = finished_workouts.get(s.workout_id)
            if wo_date:
                sets_by_date.setdefault(wo_date, []).append(s)

        result = []
        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        for i in range(7):
            d = week_start + timedelta(days=i)
            day_sets = sets_by_date.get(d.isoformat(), [])
            tonnage = sum((s.weight or 0) * (s.reps or 0) for s in day_sets)
            result.append({
                "date": d.isoformat(),
                "day": day_names[i],
                "is_today": d == today,
                "sets": len(day_sets),
                "tonnage_kg": round(tonnage, 1),
            })
    return result


@app.get("/api/analytics/weekly-volume")
def get_weekly_volume(profile_id: Optional[int] = Query(default=None), weeks: int = Query(default=12)):
    """Per-week set count and total tonnage for the last N weeks (Mon–Sun)."""
    from datetime import date, timedelta
    today = date.today()
    week_start_current = today - timedelta(days=today.weekday())  # Monday

    with Session(engine) as session:
        wo_q = select(Workout).where(Workout.status == "finished")
        if profile_id is not None:
            wo_q = wo_q.where(Workout.profile_id == profile_id)
        finished_workouts = {w.id: str(w.date)[:10] for w in session.exec(wo_q).all()}

        all_sets = session.exec(
            select(SetEntry).where(SetEntry.workout_id.in_(list(finished_workouts.keys())))
        ).all() if finished_workouts else []

        result = []
        for i in range(weeks - 1, -1, -1):
            wk_start = week_start_current - timedelta(weeks=i)
            wk_end = wk_start + timedelta(weeks=1)
            wk_workouts = {
                wid for wid, d in finished_workouts.items()
                if d and date.fromisoformat(d) >= wk_start and date.fromisoformat(d) < wk_end
            }
            wk_sets = [s for s in all_sets if s.workout_id in wk_workouts]
            tonnage = sum((s.weight or 0) * (s.reps or 0) for s in wk_sets)
            result.append({
                "week_start": wk_start.isoformat(),
                "sets": len(wk_sets),
                "tonnage_kg": round(tonnage, 1),
            })
    return result


@app.get("/api/analytics/muscle-groups")
def get_muscle_groups(profile_id: Optional[int] = Query(default=None), weeks: int = Query(default=12)):
    """Sets and tonnage grouped by muscle group for the last N weeks."""
    from datetime import date, timedelta
    today = date.today()
    week_start_current = today - timedelta(days=today.weekday())
    since = week_start_current - timedelta(weeks=weeks - 1)

    with Session(engine) as session:
        ex_q = select(Exercise)
        if profile_id is not None:
            ex_q = ex_q.where(Exercise.profile_id == profile_id)
        exercises = {e.id: e for e in session.exec(ex_q).all()}

        wo_q = select(Workout).where(Workout.status == "finished")
        if profile_id is not None:
            wo_q = wo_q.where(Workout.profile_id == profile_id)
        workout_ids = {
            w.id for w in session.exec(wo_q).all()
            if w.date and date.fromisoformat(str(w.date)[:10]) >= since
        }

        all_sets = session.exec(
            select(SetEntry).where(SetEntry.workout_id.in_(list(workout_ids)))
        ).all() if workout_ids else []

        groups: dict = {}
        for s in all_sets:
            ex = exercises.get(s.exercise_id)
            part = (ex.body_part if ex and ex.body_part else 'Other')
            g = groups.setdefault(part, {'body_part': part, 'sets': 0, 'tonnage_kg': 0.0})
            g['sets'] += 1
            g['tonnage_kg'] += (s.weight or 0) * (s.reps or 0)

        result = sorted(groups.values(), key=lambda x: x['sets'], reverse=True)
        for g in result:
            g['tonnage_kg'] = round(g['tonnage_kg'], 1)
    return result


@app.get("/api/analytics/prs")
def get_prs(profile_id: Optional[int] = Query(default=None)):
    """Per-exercise best estimated 1RM (Epley) for a profile."""
    with Session(engine) as session:
        ex_q = select(Exercise)
        if profile_id is not None:
            ex_q = ex_q.where(Exercise.profile_id == profile_id)
        exercises = {e.id: e for e in session.exec(ex_q).all()}

        wo_q = select(Workout).where(Workout.status == "finished")
        if profile_id is not None:
            wo_q = wo_q.where(Workout.profile_id == profile_id)
        workout_ids = {w.id for w in session.exec(wo_q).all()}

        all_sets = session.exec(select(SetEntry).where(SetEntry.workout_id.in_(workout_ids))).all() if workout_ids else []

        best: dict = {}
        for s in all_sets:
            if not s.exercise_id or s.weight is None:
                continue
            reps = s.reps or 1
            e1rm = s.weight * (1 + reps / 30)
            cur = best.get(s.exercise_id)
            if cur is None or e1rm > cur["e1rm"]:
                best[s.exercise_id] = {"weight": s.weight, "reps": s.reps, "e1rm": round(e1rm, 1)}

        result = []
        for ex_id, data in best.items():
            ex = exercises.get(ex_id)
            if ex:
                result.append({"exercise_id": ex_id, "name": ex.name,
                                "body_part": ex.body_part or "Other",
                                "best_weight": data["weight"], "best_reps": data["reps"], "e1rm": data["e1rm"]})
        result.sort(key=lambda x: x["e1rm"], reverse=True)
    return result


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _workout_out(w: Workout, sets: list) -> schemas.WorkoutOut:
    return schemas.WorkoutOut(
        id=w.id, name=w.name, date=w.date, start_time=w.start_time, end_time=w.end_time,
        status=w.status,
        set_count=len(sets),
        unique_exercises_count=len({s.exercise_id for s in sets}),
        notes=w.notes,
        is_rest_day=w.is_rest_day or False,
    )


if __name__ == '__main__':
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

