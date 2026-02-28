"""Seed the database with a large set of common exercises.

This list is a curated set of common barbell, dumbbell, machine,
bodyweight and cardio exercises (inspired by common workout apps).
The script is idempotent: it won't duplicate exercises already present.
"""
from sqlmodel import Session, select
from backend.db import engine, create_db_and_tables
from backend.models import Exercise


EXERCISES = [
    {"name": "Back Squat", "body_part": "Legs", "equipment": "Barbell"},
    {"name": "Front Squat", "body_part": "Legs", "equipment": "Barbell"},
    {"name": "Overhead Press", "body_part": "Shoulders", "equipment": "Barbell"},
    {"name": "Bench Press", "body_part": "Chest", "equipment": "Barbell"},
    {"name": "Incline Bench Press", "body_part": "Chest", "equipment": "Barbell"},
    {"name": "Decline Bench Press", "body_part": "Chest", "equipment": "Barbell"},
    {"name": "Dumbbell Bench Press", "body_part": "Chest", "equipment": "Dumbbell"},
    {"name": "Incline Dumbbell Press", "body_part": "Chest", "equipment": "Dumbbell"},
    {"name": "Decline Dumbbell Press", "body_part": "Chest", "equipment": "Dumbbell"},
    {"name": "Push-Up", "body_part": "Chest", "equipment": "Bodyweight"},
    {"name": "Dip", "body_part": "Chest", "equipment": "Bodyweight"},
    {"name": "Deadlift", "body_part": "Legs", "equipment": "Barbell"},
    {"name": "Romanian Deadlift", "body_part": "Legs", "equipment": "Barbell"},
    {"name": "Sumo Deadlift", "body_part": "Legs", "equipment": "Barbell"},
    {"name": "Trap Bar Deadlift", "body_part": "Legs", "equipment": "Trap Bar"},
    {"name": "Hip Thrust", "body_part": "Legs", "equipment": "Barbell"},
    {"name": "Glute Bridge", "body_part": "Legs", "equipment": "Bodyweight"},
    {"name": "Barbell Row", "body_part": "Back", "equipment": "Barbell"},
    {"name": "Pendlay Row", "body_part": "Back", "equipment": "Barbell"},
    {"name": "Dumbbell Row", "body_part": "Back", "equipment": "Dumbbell"},
    {"name": "T-Bar Row", "body_part": "Back", "equipment": "Machine"},
    {"name": "Seated Cable Row", "body_part": "Back", "equipment": "Cable"},
    {"name": "Lat Pulldown", "body_part": "Back", "equipment": "Cable"},
    {"name": "Pull-Up", "body_part": "Back", "equipment": "Bodyweight"},
    {"name": "Chin-Up", "body_part": "Back", "equipment": "Bodyweight"},
    {"name": "Pullover", "body_part": "Back", "equipment": "Dumbbell"},
    {"name": "Face Pull", "body_part": "Shoulders", "equipment": "Cable"},
    {"name": "Cable Fly", "body_part": "Chest", "equipment": "Cable"},
    {"name": "Chest Fly", "body_part": "Chest", "equipment": "Dumbbell"},
    {"name": "Lateral Raise", "body_part": "Shoulders", "equipment": "Dumbbell"},
    {"name": "Front Raise", "body_part": "Shoulders", "equipment": "Dumbbell"},
    {"name": "Rear Delt Fly", "body_part": "Shoulders", "equipment": "Dumbbell"},
    {"name": "Arnold Press", "body_part": "Shoulders", "equipment": "Dumbbell"},
    {"name": "Seated Dumbbell Press", "body_part": "Shoulders", "equipment": "Dumbbell"},
    {"name": "Barbell Shrug", "body_part": "Shoulders", "equipment": "Barbell"},
    {"name": "Farmer's Walk", "body_part": "Full Body", "equipment": "Dumbbell"},
    {"name": "Bicep Curl", "body_part": "Arms", "equipment": "Dumbbell"},
    {"name": "Hammer Curl", "body_part": "Arms", "equipment": "Dumbbell"},
    {"name": "Preacher Curl", "body_part": "Arms", "equipment": "EZ Bar"},
    {"name": "Concentration Curl", "body_part": "Arms", "equipment": "Dumbbell"},
    {"name": "Tricep Extension", "body_part": "Arms", "equipment": "Dumbbell"},
    {"name": "Skull Crusher", "body_part": "Arms", "equipment": "EZ Bar"},
    {"name": "Tricep Pushdown", "body_part": "Arms", "equipment": "Cable"},
    {"name": "Overhead Tricep Extension", "body_part": "Arms", "equipment": "Dumbbell"},
    {"name": "Leg Press", "body_part": "Legs", "equipment": "Machine"},
    {"name": "Leg Extension", "body_part": "Legs", "equipment": "Machine"},
    {"name": "Leg Curl", "body_part": "Legs", "equipment": "Machine"},
    {"name": "Walking Lunge", "body_part": "Legs", "equipment": "Bodyweight"},
    {"name": "Static Lunge", "body_part": "Legs", "equipment": "Bodyweight"},
    {"name": "Bulgarian Split Squat", "body_part": "Legs", "equipment": "Bodyweight"},
    {"name": "Calf Raise", "body_part": "Legs", "equipment": "Bodyweight"},
    {"name": "Seated Calf Raise", "body_part": "Legs", "equipment": "Machine"},
    {"name": "Single-Leg Deadlift", "body_part": "Legs", "equipment": "Dumbbell"},
    {"name": "Good Morning", "body_part": "Legs", "equipment": "Barbell"},
    {"name": "Back Extension", "body_part": "Back", "equipment": "Bodyweight"},
    {"name": "Hyperextension", "body_part": "Back", "equipment": "Bodyweight"},
    {"name": "Kettlebell Swing", "body_part": "Full Body", "equipment": "Kettlebell"},
    {"name": "Clean and Jerk", "body_part": "Full Body", "equipment": "Barbell"},
    {"name": "Snatch", "body_part": "Full Body", "equipment": "Barbell"},
    {"name": "Power Clean", "body_part": "Full Body", "equipment": "Barbell"},
    {"name": "Push Press", "body_part": "Shoulders", "equipment": "Barbell"},
    {"name": "Thruster", "body_part": "Full Body", "equipment": "Barbell"},
    {"name": "Box Jump", "body_part": "Legs", "equipment": "Bodyweight"},
    {"name": "Pistol Squat", "body_part": "Legs", "equipment": "Bodyweight"},
    {"name": "Sled Push", "body_part": "Legs", "equipment": "Other"},
    {"name": "Sled Pull", "body_part": "Legs", "equipment": "Other"},
    {"name": "Battle Ropes", "body_part": "Cardio", "equipment": "Other"},
    {"name": "Jump Rope", "body_part": "Cardio", "equipment": "Other"},
    {"name": "Mountain Climbers", "body_part": "Core", "equipment": "Bodyweight"},
    {"name": "Burpee", "body_part": "Full Body", "equipment": "Bodyweight"},
    {"name": "Plank", "body_part": "Core", "equipment": "Bodyweight"},
    {"name": "Side Plank", "body_part": "Core", "equipment": "Bodyweight"},
    {"name": "Hanging Leg Raise", "body_part": "Core", "equipment": "Bodyweight"},
    {"name": "Russian Twist", "body_part": "Core", "equipment": "Bodyweight"},
    {"name": "Bicycle Crunch", "body_part": "Core", "equipment": "Bodyweight"},
    {"name": "Cable Woodchop", "body_part": "Core", "equipment": "Cable"},
    {"name": "Rowing (Machine)", "body_part": "Cardio", "equipment": "Machine"},
    {"name": "Stationary Bike", "body_part": "Cardio", "equipment": "Machine"},
    {"name": "Running (Treadmill)", "body_part": "Cardio", "equipment": "Machine"},
    {"name": "Walking", "body_part": "Cardio", "equipment": "Bodyweight"},
    {"name": "Swimming", "body_part": "Cardio", "equipment": "Bodyweight"},
    {"name": "Sprints", "body_part": "Cardio", "equipment": "Bodyweight"},
    {"name": "Incline Walk", "body_part": "Cardio", "equipment": "Machine"},
    {"name": "Farmers Carry", "body_part": "Full Body", "equipment": "Dumbbell"},
    {"name": "Weighted Carry", "body_part": "Full Body", "equipment": "Dumbbell"},
    {"name": "Cable Lateral Raise", "body_part": "Shoulders", "equipment": "Cable"},
    {"name": "EZ Bar Curl", "body_part": "Arms", "equipment": "EZ Bar"},
    {"name": "Hack Squat", "body_part": "Legs", "equipment": "Machine"},
    {"name": "Chest Supported Row", "body_part": "Back", "equipment": "Machine"},
    {"name": "Inverted Row", "body_part": "Back", "equipment": "Bodyweight"},
    {"name": "Glute Ham Raise", "body_part": "Legs", "equipment": "Machine"},
    {"name": "Nordic Hamstring Curl", "body_part": "Legs", "equipment": "Bodyweight"},
    {"name": "Isometric Hold", "body_part": "Core", "equipment": "Bodyweight"},
    {"name": "TRX Row", "body_part": "Back", "equipment": "TRX"},
    {"name": "TRX Push-Up", "body_part": "Chest", "equipment": "TRX"},
    {"name": "Cable Face Pull", "body_part": "Shoulders", "equipment": "Cable"},
    {"name": "Cable Reverse Fly", "body_part": "Shoulders", "equipment": "Cable"},
]


def seed():
    create_db_and_tables()
    added = 0
    made_global = 0
    with Session(engine) as session:
        for ex in EXERCISES:
            exists = session.exec(select(Exercise).where(Exercise.name == ex["name"])).first()
            if not exists:
                session.add(
                    Exercise(
                        name=ex["name"],
                        body_part=ex["body_part"],
                        equipment=ex["equipment"],
                        # profile_id intentionally left None → global
                    )
                )
                added += 1
            elif exists.profile_id is not None:
                # Exercise was previously assigned to a profile — make it global
                exists.profile_id = None
                session.add(exists)
                made_global += 1
        session.commit()

    print(f"Seed complete — {added} exercises added, {made_global} made global.")


if __name__ == '__main__':
    seed()
