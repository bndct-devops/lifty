# lifty

A self-hosted workout tracker. FastAPI backend, React PWA frontend, SQLite database, deployed via Docker Compose.

---

## Features

- **Multiple profiles** — switch between users on the same instance
- **Global exercise library** — 100+ built-in exercises (barbell, dumbbell, cable, machine, bodyweight, cardio), always present on startup
- **Custom exercises** — add your own, profile-specific
- **Active workout view** — log sets with reps + weight, reorder exercises, rest timer with vibration, inline exercise notes (markdown)
- **Workout name editing** — tap the title to rename inline
- **Rest days** — mark a day as rest from the home screen
- **History** — full workout log with per-workout detail sheet, stats, muscle group breakdown
- **Progress tab**
  - PRs per exercise (Epley estimated 1RM)
  - Weekly volume bar chart
  - Muscle group donut chart
  - 26-week activity heatmap
- **Strong CSV import** — import your existing workout history from the Strong app
- **CSV export** — export all workouts per profile
- **Themes** — dark / light / per-profile
- **PWA-ready** — installable on iOS/Android via nginx

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
  src/
    App.jsx          # entire frontend (~1800 lines, single-component)
    api.js           # fetch wrappers for all backend endpoints
    styles.css       # CSS custom properties + layout
  nginx.conf         # proxies /api/* to backend
scripts/
  dev_up.sh          # one-command local dev start
  seed_dev_data.py   # seeds realistic workout history via the API
docker-compose.yml       # local dev (builds from source)
docker-compose.prod.yml  # production (pulls from ghcr.io)
.github/workflows/
  build-push.yml     # CI: build multi-arch images, push to ghcr.io
```
