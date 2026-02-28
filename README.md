# lifty

A self-hosted workout tracker. FastAPI backend, React PWA frontend, SQLite database, deployed via Docker Compose.

---

## Screenshots

<p align="center">
  <img src="docs/screenshots/home.png" width="180" alt="Home tab" />
  <img src="docs/screenshots/workout.png" width="180" alt="Active workout" />
  <img src="docs/screenshots/history.png" width="180" alt="History" />
  <img src="docs/screenshots/history-detail.png" width="180" alt="Workout detail" />
  <img src="docs/screenshots/progress.png" width="180" alt="Progress" />
  <img src="docs/screenshots/settings.png" width="180" alt="Settings" />
</p>

---

## Features

- **Multiple profiles** — switch between users on the same instance, each with their own avatar colour, theme, and settings
- **Global exercise library** — 100+ built-in exercises (barbell, dumbbell, cable, machine, bodyweight, cardio), always present on startup
- **Custom exercises** — add your own, profile-specific
- **Active workout view** — log sets with reps + weight, reorder exercises, inline exercise notes
- **Rest timer** — countdown with configurable duration (60/90/120/180s), Web Audio ding on finish, vibration, background-accurate (stays correct after screen lock)
- **Workout name editing** — tap the title to rename inline
- **Rest days** — mark a day as rest from the home screen
- **History** — full workout log with monthly calendar, per-workout detail sheet, stats, and muscle group breakdown
- **Progress tab**
  - PRs per exercise (Epley estimated 1RM), grouped by body part
  - Weekly/daily volume bar chart (sets or tonnage)
  - Muscle group donut chart
  - 26-week activity heatmap
- **Strong CSV import** — import your existing workout history from the Strong app
- **CSV export** — export all workouts per profile
- **Themes** — Dark, Light, Catppuccin Mocha / Macchiato / Frappé / Latte
- **Per-profile settings** — unit (kg/lbs), theme, avatar colour, week start day (Mon/Sun), default rest duration, rest timer ding toggle
- **PWA** — installable on iOS and Android, flamingo barbell icon, themed status bar

---

## PWA & Service Worker

lifty ships a service worker that provides:

- **Offline support** — static assets (JS/CSS/icons) are served from cache after first load; API responses are cached as fallback when offline
- **Background rest timer notifications** — when a rest timer starts, the SW schedules a push notification for the exact end time. This fires even if the browser tab is suspended or the screen is locked

**Platform notes:**
- **Android** — full support (notifications, offline, install to home screen)
- **iOS 16.4+** — requires the app to be added to the home screen first (PWA install via Share → Add to Home Screen). Background notifications and offline caching then work as expected
- **iOS < 16.4 / desktop Safari** — the in-page ding and vibration still fire when the app is visible; background notifications are not supported

---

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI + SQLModel + SQLite |
| Frontend | React 18 + Vite + plain CSS |
| Serving | nginx (frontend), uvicorn (backend) |
| Containers | Docker + Docker Compose |
| CI | GitHub Actions → ghcr.io |

---

## Local development

```bash
./scripts/dev_up.sh
```

This builds both containers, waits for the backend to be healthy, and seeds dev data (exercises + ~5 weeks of workouts with progressive overload).

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API docs**: http://localhost:8000/docs

Reset the database:

```bash
rm data/lifty.db
docker compose restart backend
```

---

## Deployment (Unraid / any Docker host)

Images are built and pushed to `ghcr.io` automatically on every push to `main`. To deploy:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

The default data path in `docker-compose.prod.yml` is `/mnt/user/appdata/lifty` — adjust to match your host.

Images:
- `ghcr.io/bndct-devops/lifty-backend:latest`
- `ghcr.io/bndct-devops/lifty-frontend:latest`

Both are built for `linux/amd64` and `linux/arm64`.

---

## Project structure

```
backend/
  main.py            # FastAPI app — all endpoints
  models.py          # SQLModel table definitions
  schemas.py         # Pydantic request/response types
  db.py              # engine + create_db_and_tables
  seed_exercises.py  # built-in exercise library (runs on every startup)
frontend/
  public/
    sw.js            # service worker (offline cache + background notifications)
    manifest.json    # PWA manifest
    favicon.svg      # flamingo barbell icon
  src/
    App.jsx          # entire frontend (single-component)
    api.js           # fetch wrappers for all backend endpoints
    styles.css       # CSS custom properties + layout
  nginx.conf         # proxies /api/* to backend
scripts/
  dev_up.sh          # one-command local dev start
docker-compose.yml       # local dev (builds from source)
docker-compose.prod.yml  # production (pulls from ghcr.io)
.github/workflows/
  build-push.yml     # CI: build multi-arch images, push to ghcr.io
```
