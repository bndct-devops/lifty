# lifty — Checkpoint (28 Feb 2026)

## How to run
- **Quick start**: `./scripts/dev_up.sh` — builds containers, waits for backend health, seeds dev data.
- **Reset DB**: `rm data/lifty.db && docker compose restart backend && python3 scripts/seed_dev_data.py`
- **Rebuild only**: `docker compose up --build -d`
- App: http://localhost:5173 · API: http://localhost:8000

## What's been built

### Backend (`backend/main.py`, `models.py`, `schemas.py`)
- Full CRUD for exercises and workouts
- `POST /api/workouts/{id}/start` and `.../finish` with timestamps
- `POST/PATCH/DELETE /api/workouts/{id}/sets/{set_id}` — add, edit, remove sets
- `GET /api/exercises/{id}/last_sets` — last session's sets for a given exercise
- `GET /api/analytics/prs` — best estimated 1RM per exercise (Epley formula)
- `POST /api/workouts` accepts optional `date` field (used by seed script)
- `WorkoutOut` includes `set_count` and `unique_exercises_count`

### Frontend (`frontend/src/App.jsx`, `api.js`, `styles.css`)
- **Bottom nav** — Home / Exercises / History / Progress (4 tabs, fixed)
- **Home tab** — weekly stats (workouts, sets, streak), in-progress banner, last workout card
- **History tab** — all workouts newest-first, status badges
- **Exercises tab** — body-part chip filter, collapsible groups, pencil-icon inline editing, collapsible "＋ Add Exercise" form
- **Progress tab** — PRs grouped by body part (Epley 1RM), monthly calendar with tap-to-expand set detail
- **ActiveWorkoutView** (full-screen workout mode):
  - One-set-at-a-time flow, big inputs
  - Rest timer — auto-starts after logging a set, vibrates on zero, duration saved to localStorage
  - Exercise picker with search
  - "Same as last" shortcut + "Last time" reference card
  - Per-set delete

### Dev tooling
- `scripts/seed_dev_data.py` — pure stdlib Python, idempotent, 49 exercises + 16 workouts over 5 weeks with progressive overload

---

## What's next (rough priority order)

1. **Volume chart** — weekly bar chart (total sets or tonnage per week) on the Progress tab. Could use `recharts` or hand-rolled SVG. Would make Progress actually useful at a glance.
2. **Edit workout name** — no way to rename a workout. A tap-to-edit title in `ActiveWorkoutView` would be a quick win.
3. **Workout templates** — save a finished workout as a template; starting from a template pre-populates exercise order and last-used weights.
4. **Reorder exercises/sets** — up/down arrows (or drag) within the active workout view.
5. **Bodyweight tracking** — separate log for bodyweight, shown on Progress tab.
6. **Export** — download workouts as CSV or JSON.

## Known issues / things to watch
- `docker-compose.yml` has an obsolete `version:` key — generates a warning on every compose command, safe to remove.
- Calendar date alignment: workout `date` is stored as a date-only string; timezones west of UTC may see workouts appear on the wrong day. Worth testing.
- `dev_up.sh` calls `python3` for the seed step — may need a `python` fallback on some machines.
- Rest timer doesn't account for the phone screen locking mid-rest — test on a real mobile device.
