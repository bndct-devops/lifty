from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime


class Profile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    pin_hash: Optional[str] = None   # reserved for future PIN auth
    unit: str = Field(default="kg")  # "kg" or "lbs"
    theme: str = Field(default="lifty")
    rest_duration: int = Field(default=90)
    week_start: str = Field(default="monday")  # "monday" or "sunday"
    avatar_color: str = Field(default="#60a5fa")
    ding_enabled: bool = Field(default=True)
    overload_hints: bool = Field(default=True)
    plate_calculator: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ExerciseBase(SQLModel):
    name: str
    description: Optional[str] = None
    body_part: Optional[str] = None
    equipment: Optional[str] = None


class Exercise(ExerciseBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: Optional[int] = Field(default=None, foreign_key="profile.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Workout(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: Optional[int] = Field(default=None, foreign_key="profile.id")
    name: str
    date: datetime = Field(default_factory=datetime.utcnow)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[str] = Field(default="not_started")
    notes: Optional[str] = None
    is_rest_day: bool = Field(default=False)


class SetEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    workout_id: Optional[int] = Field(default=None, foreign_key="workout.id")
    exercise_id: Optional[int] = Field(default=None, foreign_key="exercise.id")
    reps: Optional[int] = None
    weight: Optional[float] = None
    order: int = Field(default=0)
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)


class BodyweightEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id")
    weight_kg: float
    date: datetime = Field(default_factory=datetime.utcnow)


class PushSubscription(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    profile_id: int = Field(foreign_key="profile.id")
    endpoint: str
    p256dh: str
    auth: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    order: Optional[int] = Field(default=0)
