from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ProfileCreate(BaseModel):
    name: str
    unit: str = "kg"
    theme: str = "dark"


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    theme: Optional[str] = None
    rest_duration: Optional[int] = None
    week_start: Optional[str] = None
    avatar_color: Optional[str] = None
    ding_enabled: Optional[bool] = None


class ProfileOut(BaseModel):
    id: int
    name: str
    unit: str
    theme: str
    rest_duration: int
    week_start: str
    avatar_color: str
    ding_enabled: bool
    has_pin: bool = False
    created_at: datetime

    class Config:
        orm_mode = True


class WorkoutCreate(BaseModel):
    name: str
    date: Optional[datetime] = None
    profile_id: Optional[int] = None


class WorkoutUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    is_rest_day: Optional[bool] = None
class PinSet(BaseModel):
    pin: Optional[str] = None  # null/empty to clear PIN


class PinVerify(BaseModel):
    pin: str


class BodyweightIn(BaseModel):
    weight_kg: float
    date: Optional[datetime] = None


class BodyweightOut(BaseModel):
    id: int
    profile_id: int
    weight_kg: float
    date: datetime

    class Config:
        orm_mode = True


class ExerciseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    body_part: Optional[str] = None
    equipment: Optional[str] = None
    profile_id: Optional[int] = None


class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    body_part: Optional[str] = None
    equipment: Optional[str] = None


class WorkoutOut(BaseModel):
    id: int
    name: str
    date: datetime
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    status: Optional[str]
    set_count: int = 0
    unique_exercises_count: int = 0
    notes: Optional[str] = None
    is_rest_day: bool = False

    class Config:
        orm_mode = True


class SetCreate(BaseModel):
    exercise_id: int
    reps: Optional[int] = None
    weight: Optional[float] = None
    order: Optional[int] = 0


class SetUpdate(BaseModel):
    reps: Optional[int] = None
    weight: Optional[float] = None
    order: Optional[int] = None


class SetOut(BaseModel):
    id: int
    workout_id: int
    exercise_id: int
    reps: Optional[int]
    weight: Optional[float]
    timestamp: datetime
    order: int

    class Config:
        orm_mode = True


class WorkoutDetail(BaseModel):
    workout: WorkoutOut
    sets: List[SetOut]

    class Config:
        orm_mode = True
