#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Building and starting lifty (backend + frontend) via docker-compose..."
docker compose up --build -d

echo "Waiting for backend to become healthy at http://localhost:8000/health"
until curl -sSf http://localhost:8000/health >/dev/null 2>&1; do
  printf '.'
  sleep 1
done

echo "\nBackend is healthy — seeding dev data (exercises + workouts)..."
python3 "$ROOT_DIR/scripts/seed_dev_data.py" || {
  echo "Seed script failed — check that Python 3 is available" >&2
}

echo "\nlifty is up. Backend: http://localhost:8000, Frontend: http://localhost:5173"
