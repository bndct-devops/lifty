#!/usr/bin/env python3
"""Seed dev data via the lifty REST API.

Seeds exercises + ~5 weeks of realistic workouts with progressive overload so
the calendar, PR tracking, and volume views all have interesting data.

Usage (backend must be running):
    python scripts/seed_dev_data.py                  # uses http://localhost:8000
    python scripts/seed_dev_data.py http://my-host:8000
"""

import json
import sys
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8000"


# ---------------------------------------------------------------------------
# Tiny HTTP helpers
# ---------------------------------------------------------------------------

def get(path):
    with urllib.request.urlopen(BASE + path) as r:
        return json.loads(r.read())


def post(path, body=None):
    data = json.dumps(body).encode() if body is not None else b""
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def patch(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/json"},
        method="PATCH",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


# ---------------------------------------------------------------------------
# 1. Exercises
# ---------------------------------------------------------------------------

EXERCISES = [
    {"name": "Back Squat",              "body_part": "Legs",       "equipment": "Barbell"},
    {"name": "Front Squat",             "body_part": "Legs",       "equipment": "Barbell"},
    {"name": "Overhead Press",          "body_part": "Shoulders",  "equipment": "Barbell"},
    {"name": "Bench Press",             "body_part": "Chest",      "equipment": "Barbell"},
    {"name": "Incline Bench Press",     "body_part": "Chest",      "equipment": "Barbell"},
    {"name": "Decline Bench Press",     "body_part": "Chest",      "equipment": "Barbell"},
    {"name": "Dumbbell Bench Press",    "body_part": "Chest",      "equipment": "Dumbbell"},
    {"name": "Incline Dumbbell Press",  "body_part": "Chest",      "equipment": "Dumbbell"},
    {"name": "Push-Up",                 "body_part": "Chest",      "equipment": "Bodyweight"},
    {"name": "Dip",                     "body_part": "Chest",      "equipment": "Bodyweight"},
    {"name": "Deadlift",                "body_part": "Legs",       "equipment": "Barbell"},
    {"name": "Romanian Deadlift",       "body_part": "Legs",       "equipment": "Barbell"},
    {"name": "Sumo Deadlift",           "body_part": "Legs",       "equipment": "Barbell"},
    {"name": "Trap Bar Deadlift",       "body_part": "Legs",       "equipment": "Trap Bar"},
    {"name": "Hip Thrust",              "body_part": "Legs",       "equipment": "Barbell"},
    {"name": "Barbell Row",             "body_part": "Back",       "equipment": "Barbell"},
    {"name": "Seated Cable Row",        "body_part": "Back",       "equipment": "Cable"},
    {"name": "Lat Pulldown",            "body_part": "Back",       "equipment": "Cable"},
    {"name": "Pull-Up",                 "body_part": "Back",       "equipment": "Bodyweight"},
    {"name": "Chin-Up",                 "body_part": "Back",       "equipment": "Bodyweight"},
    {"name": "Face Pull",               "body_part": "Shoulders",  "equipment": "Cable"},
    {"name": "Cable Fly",               "body_part": "Chest",      "equipment": "Cable"},
    {"name": "Lateral Raise",           "body_part": "Shoulders",  "equipment": "Dumbbell"},
    {"name": "Arnold Press",            "body_part": "Shoulders",  "equipment": "Dumbbell"},
    {"name": "Bicep Curl",              "body_part": "Arms",       "equipment": "Dumbbell"},
    {"name": "Hammer Curl",             "body_part": "Arms",       "equipment": "Dumbbell"},
    {"name": "Preacher Curl",           "body_part": "Arms",       "equipment": "EZ Bar"},
    {"name": "Skull Crusher",           "body_part": "Arms",       "equipment": "EZ Bar"},
    {"name": "Tricep Pushdown",         "body_part": "Arms",       "equipment": "Cable"},
    {"name": "Leg Press",               "body_part": "Legs",       "equipment": "Machine"},
    {"name": "Leg Extension",           "body_part": "Legs",       "equipment": "Machine"},
    {"name": "Leg Curl",                "body_part": "Legs",       "equipment": "Machine"},
    {"name": "Walking Lunge",           "body_part": "Legs",       "equipment": "Bodyweight"},
    {"name": "Bulgarian Split Squat",   "body_part": "Legs",       "equipment": "Bodyweight"},
    {"name": "Calf Raise",              "body_part": "Legs",       "equipment": "Bodyweight"},
    {"name": "Kettlebell Swing",        "body_part": "Full Body",  "equipment": "Kettlebell"},
    {"name": "Plank",                   "body_part": "Core",       "equipment": "Bodyweight"},
    {"name": "Hanging Leg Raise",       "body_part": "Core",       "equipment": "Bodyweight"},
    {"name": "Russian Twist",           "body_part": "Core",       "equipment": "Bodyweight"},
    {"name": "Cable Woodchop",          "body_part": "Core",       "equipment": "Cable"},
    {"name": "Running (Treadmill)",     "body_part": "Cardio",     "equipment": "Machine"},
    {"name": "Stationary Bike",         "body_part": "Cardio",     "equipment": "Machine"},
    {"name": "Farmers Carry",           "body_part": "Full Body",  "equipment": "Dumbbell"},
    {"name": "EZ Bar Curl",             "body_part": "Arms",       "equipment": "EZ Bar"},
    {"name": "Hack Squat",              "body_part": "Legs",       "equipment": "Machine"},
    {"name": "Chest Supported Row",     "body_part": "Back",       "equipment": "Machine"},
    {"name": "Inverted Row",            "body_part": "Back",       "equipment": "Bodyweight"},
    {"name": "Cable Face Pull",         "body_part": "Shoulders",  "equipment": "Cable"},
    {"name": "Cable Reverse Fly",       "body_part": "Shoulders",  "equipment": "Cable"},
]


def seed_exercises(profile_id):
    existing = {e["name"] for e in get(f"/api/exercises?profile_id={profile_id}")}
    added = 0
    for ex in EXERCISES:
        if ex["name"] not in existing:
            post("/api/exercises", {**ex, "profile_id": profile_id})
            added += 1
    print(f"  exercises: {added} added, {len(existing)} already present")
    # return fresh id map
    return {e["name"]: e["id"] for e in get(f"/api/exercises?profile_id={profile_id}")}


# ---------------------------------------------------------------------------
# 2. Workout templates
# Each entry: (days_ago, workout_name, [(exercise_name, sets_list)])
# sets_list: list of (reps, weight_kg)
# ---------------------------------------------------------------------------

def workout_plan(ex):
    """Return a list of (days_ago, name, exercises_sets) tuples.
    weights are chosen to show clear progress / PRs over time."""
    B = ex  # alias for brevity

    bench      = "Bench Press"
    squat      = "Back Squat"
    dl         = "Deadlift"
    ohp        = "Overhead Press"
    row        = "Barbell Row"
    pullup     = "Pull-Up"
    inc_bench  = "Incline Bench Press"
    leg_press  = "Leg Press"
    lat_pull   = "Lat Pulldown"
    curl       = "Bicep Curl"
    tri        = "Tricep Pushdown"
    calf       = "Calf Raise"
    rdl        = "Romanian Deadlift"
    face_pull  = "Face Pull"
    lunge      = "Walking Lunge"

    return [
        # --- week 5 ago ---
        (35, "Push A", [
            (bench,     [(5,80), (5 ,80), (5 ,80), (5 ,80), (5 ,80)]),
            (inc_bench, [(8 ,60), (8 ,60), (8 ,60)]),
            (ohp,       [(5 ,52.5),(5 ,52.5),(5 ,52.5)]),
            (tri,       [(12,25),(12,25),(12,25)]),
        ]),
        (33, "Pull A", [
            (dl,        [(5,120),(5,120),(5,120)]),
            (row,       [(5 ,80),(5 ,80),(5 ,80),(5 ,80)]),
            (lat_pull,  [(10,60),(10,60),(10,65)]),
            (curl,      [(12,16),(12,16),(12,16)]),
        ]),
        (32, "Legs A", [
            (squat,     [(5,100),(5,100),(5,100),(5,100),(5,100)]),
            (leg_press, [(10,140),(10,140),(10,150)]),
            (rdl,       [(8 ,80),(8 ,80),(8 ,80)]),
            (lunge,     [(12, 0),(12, 0),(12, 0)]),
            (calf,      [(15, 0),(15, 0),(15, 0)]),
        ]),
        # --- week 4 ago ---
        (28, "Push B", [
            (bench,     [(5 ,82.5),(5 ,82.5),(5 ,82.5),(5 ,82.5),(3 ,82.5)]),
            (inc_bench, [(8 ,62.5),(8 ,62.5),(7 ,62.5)]),
            (ohp,       [(5 ,55),(5 ,55),(4 ,55)]),
            (tri,       [(12,27.5),(12,27.5),(12,27.5)]),
            (face_pull, [(15,15),(15,15),(15,15)]),
        ]),
        (26, "Pull B", [
            (dl,        [(5,125),(5,125),(5,125)]),
            (pullup,    [(6,0),(6,0),(5,0)]),
            (row,       [(5 ,82.5),(5 ,82.5),(5 ,82.5),(5 ,82.5)]),
            (lat_pull,  [(10,65),(10,65),(10,67.5)]),
            (curl,      [(12,17.5),(12,17.5),(10,17.5)]),
        ]),
        (25, "Legs B", [
            (squat,     [(5,102.5),(5,102.5),(5,102.5),(5,102.5),(5,102.5)]),
            (leg_press, [(10,150),(10,150),(10,155)]),
            (rdl,       [(8 ,82.5),(8 ,82.5),(8 ,85)]),
            (lunge,     [(12, 0),(12, 0),(12, 0)]),
            (calf,      [(15, 0),(20, 0),(20, 0)]),
        ]),
        # --- week 3 ago ---
        (21, "Push A", [
            (bench,     [(5 ,85),(5 ,85),(5 ,85),(5 ,85),(5 ,85)]),
            (inc_bench, [(8 ,65),(8 ,65),(8 ,65)]),
            (ohp,       [(5 ,57.5),(5 ,57.5),(5 ,57.5)]),
            (tri,       [(12,30),(12,30),(12,30)]),
            (face_pull, [(15,15),(15,15),(15,17.5)]),
        ]),
        (19, "Pull A", [
            (dl,        [(5,130),(5,130),(5,130)]),
            (pullup,    [(7,0),(7,0),(6,0),(6,0)]),
            (row,       [(5 ,85),(5 ,85),(5 ,85),(5 ,85)]),
            (lat_pull,  [(10,67.5),(10,67.5),(10,70)]),
            (curl,      [(12,17.5),(12,17.5),(12,17.5)]),
        ]),
        (18, "Legs A", [
            (squat,     [(5,105),(5,105),(5,105),(5,105),(5,105)]),
            (leg_press, [(10,155),(10,160),(10,160)]),
            (rdl,       [(8 ,85),(8 ,87.5),(8 ,87.5)]),
            (lunge,     [(12, 0),(12, 0),(12, 0)]),
            (calf,      [(20, 0),(20, 0),(20, 0)]),
        ]),
        # --- week 2 ago ---
        (14, "Push B", [
            (bench,     [(5 ,87.5),(5 ,87.5),(5 ,87.5),(5 ,87.5),(4 ,87.5)]),
            (inc_bench, [(8 ,67.5),(8 ,67.5),(8 ,67.5)]),
            (ohp,       [(5 ,60),(5 ,60),(5 ,60)]),
            (tri,       [(12,32.5),(12,32.5),(12,32.5)]),
            (face_pull, [(15,17.5),(15,17.5),(15,20)]),
        ]),
        (12, "Pull B", [
            (dl,        [(5,135),(5,135),(3,135)]),
            (pullup,    [(8,0),(8,0),(7,0),(6,0)]),
            (row,       [(5 ,87.5),(5 ,87.5),(5 ,87.5),(5 ,87.5)]),
            (lat_pull,  [(10,70),(10,70),(10,72.5)]),
            (curl,      [(12,20),(12,20),(12,20)]),
        ]),
        (11, "Legs B", [
            (squat,     [(5,107.5),(5,107.5),(5,107.5),(5,107.5),(5,107.5)]),
            (leg_press, [(10,160),(10,165),(10,165)]),
            (rdl,       [(8 ,90),(8 ,90),(8 ,90)]),
            (lunge,     [(12, 0),(12, 0),(12, 0)]),
            (calf,      [(20, 0),(20, 0),(25, 0)]),
        ]),
        # --- last week ---
        (7, "Push A", [
            (bench,     [(5 ,90),(5 ,90),(5 ,90),(5 ,90),(5 ,90)]),
            (inc_bench, [(8 ,70),(8 ,70),(8 ,70)]),
            (ohp,       [(5 ,62.5),(5 ,62.5),(5 ,62.5)]),
            (tri,       [(12,35),(12,35),(12,35)]),
            (face_pull, [(15,20),(15,20),(15,20)]),
        ]),
        (5, "Pull A", [
            (dl,        [(5,140),(5,140),(5,140)]),
            (pullup,    [(9,0),(8,0),(8,0),(7,0)]),
            (row,       [(5 ,90),(5 ,90),(5 ,90),(5 ,90)]),
            (lat_pull,  [(10,72.5),(10,75),(10,75)]),
            (curl,      [(12,20),(12,20),(12,22.5)]),
        ]),
        (4, "Legs A", [
            (squat,     [(5,110),(5,110),(5,110),(5,110),(5,110)]),
            (leg_press, [(10,165),(10,170),(10,170)]),
            (rdl,       [(8 ,92.5),(8 ,92.5),(8 ,95)]),
            (lunge,     [(12, 0),(12, 0),(12, 0)]),
            (calf,      [(25, 0),(25, 0),(25, 0)]),
        ]),
        # --- this week ---
        (2, "Push B", [
            (bench,     [(5 ,92.5),(5 ,92.5),(5 ,92.5),(5 ,92.5),(5 ,92.5)]),
            (inc_bench, [(8 ,72.5),(8 ,72.5),(8 ,72.5)]),
            (ohp,       [(5 ,65),(5 ,65),(5 ,65)]),
            (tri,       [(12,37.5),(12,37.5),(12,37.5)]),
            (face_pull, [(15,22.5),(15,22.5),(15,22.5)]),
        ]),
    ]


# ---------------------------------------------------------------------------
# 3. Seed workouts
# ---------------------------------------------------------------------------

def utcnow():
    return datetime.now(tz=timezone.utc)


def seed_workouts(ex_map, profile_id):
    existing_names = {w["name"] + "_" + w["date"][:10] for w in get(f"/api/workouts?profile_id={profile_id}")}
    added = 0
    now = utcnow()

    for days_ago, name, exercise_sets in workout_plan(ex_map):
        workout_date = now - timedelta(days=days_ago)
        date_str = workout_date.strftime("%Y-%m-%d")
        key = name + "_" + date_str

        if key in existing_names:
            continue

        # Create workout with the correct past date
        wo = post("/api/workouts", {
            "name": name,
            "date": workout_date.isoformat(),
            "profile_id": profile_id,
        })
        wo_id = wo["id"]

        post(f"/api/workouts/{wo_id}/start")
        order = 0
        for ex_name, sets in exercise_sets:
            ex_id = ex_map.get(ex_name)
            if not ex_id:
                continue
            for reps, weight in sets:
                post(f"/api/workouts/{wo_id}/sets", {
                    "exercise_id": ex_id,
                    "reps": reps,
                    "weight": float(weight),
                    "order": order,
                })
                order += 1
        post(f"/api/workouts/{wo_id}/finish")
        added += 1
        print(f"    + {date_str} — {name} ({order} sets)")

    print(f"  workouts: {added} added")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    print(f"Seeding dev data → {BASE}")

    # Health check
    try:
        get("/health")
    except urllib.error.URLError as e:
        print(f"ERROR: Cannot reach {BASE}/health — is the backend running? ({e})")
        sys.exit(1)

    print("  backend reachable ✓")

    # Find or use the first profile
    profiles = get("/api/profiles")
    if not profiles:
        print("ERROR: No profiles found — start the backend first so migration can create the default profile.")
        sys.exit(1)
    profile_id = profiles[0]["id"]
    print(f"  seeding into profile: {profiles[0]['name']} (id={profile_id})")

    print("Seeding exercises…")
    ex_map = seed_exercises(profile_id)

    print("Seeding workouts…")
    seed_workouts(ex_map, profile_id)

    print("Done.")


if __name__ == "__main__":
    main()
