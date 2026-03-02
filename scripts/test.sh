#!/usr/bin/env bash
# Run backend tests inside a Python 3.11 container (matches CI).
# Usage: ./scripts/test.sh [pytest args...]
#   e.g. ./scripts/test.sh -k test_workouts -v
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

docker run --rm \
  -v "$REPO_ROOT":/app \
  -w /app \
  python:3.11-slim \
  sh -c "pip install -q -r backend/requirements.txt -r backend/requirements-test.txt && PYTHONPATH=. pytest backend/tests/ ${*:-"-v"}"
