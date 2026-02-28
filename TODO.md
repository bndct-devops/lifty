# lifty — Checkpoint (28 Feb 2026)

## How to run
- **Quick start**: `./scripts/dev_up.sh`
- **Rebuild**: `docker compose up --build -d`
- **Reset DB**: `rm data/lifty.db && docker compose restart backend`
- App: http://localhost:5173 · API: http://localhost:8000
- **Prod** (Unraid/Dockge): frontend `:3420`, backend `:3421` via `docker-compose.prod.yml`

## Stack
- **Backend**: FastAPI + SQLModel + SQLite, Python 3.11
- **Frontend**: React 18 + Vite, single `App.jsx`, served via nginx
- **CI**: GitHub Actions → `ghcr.io/bndct-devops/lifty-{frontend,backend}:latest` (multi-arch amd64+arm64, concurrency cancellation on push)

---

## What's been built

### Backend
- Full CRUD: exercises (global, seeded on startup), workouts, sets
- `POST /api/workouts/{id}/start` + `.../finish` with timestamps
- `GET /api/exercises/{id}/last_sets` — last session's sets per exercise
- `GET /api/analytics/prs` — best estimated 1RM per exercise (Epley)
- `GET /api/analytics/daily_volume`, `weekly_volume`, `muscle_groups`
- `POST /api/import/strong` — Strong CSV import (skips blank/rest-timer rows, duplicate workouts)
- `GET /api/profiles/{id}/export.csv`
- `DELETE /api/profiles/{profile_id}/workouts` — delete all workouts for a profile
- `POST /api/workouts/{id}/rest_day` — mark rest day

### Frontend
- **Multi-profile** support with local profile selector
- **4-tab bottom nav**: Home / Exercises / History / Progress
- **Home tab**: weekly stats, streak, in-progress banner, last workout card
- **Exercises tab**: body-part chip filter, collapsible groups, inline edit, add exercise form
- **History tab**: workout list with detail sheet (swipe-to-dismiss), stats, muscle donut, sets
- **Progress tab**: PRs per body part (Epley 1RM), weekly volume bar chart, muscle group donut, activity heatmap, monthly calendar
- **ActiveWorkoutView**:
  - Sets table with prev-session reference, "Same as last" shortcut, per-set delete, reorder exercises (↑↓)
  - **Rest timer**: absolute-time countdown (stays accurate after backgrounding), Web Audio ding on finish, vibration, Notification API permission request, duration selector (60/90/120/180s), `visibilitychange` correction on resume
  - Workout notes (markdown-lite)
  - Mark rest day
- **Settings sheet** (swipe-to-dismiss): rename, units (kg/lbs), themes, export, Strong import, danger zone (delete all workouts with type-to-confirm)
- **Themes**: Dark, Light, Catppuccin Mocha / Macchiato / Frappé / Latte
- **PWA**: `manifest.json`, `theme-color`, Apple mobile web app meta tags, flamingo barbell favicon (SVG, transparent bg)
- **Flat SVG icons** in import/export (no emoji)
- **Reusable `BottomSheet`** component (swipe-to-dismiss, body scroll lock, `dragZoneContent` slot) used by all sheets
- Safari zoom fix (`font-size: 16px` on all inputs)

---

## Known issues / things to watch
- `docker-compose.yml` has an obsolete `version:` key — harmless warning, safe to remove.
- Calendar date alignment: workout `date` is stored as date-only; timezones west of UTC may see workouts on the wrong day.
- iOS Safari kills backgrounded JS after ~30s; the ding won't sound while the screen is locked. `visibilitychange` corrects the timer display on return, but the audio fires then too.

---

## Possible next things
- Workout templates (start from a previous workout's exercise list)
- Bodyweight log on Progress tab
- Service Worker for proper offline support + background push notifications (fixes iOS ding limitation)

