from sqlmodel import SQLModel, create_engine
import os

DB_FILE = os.environ.get("LIFTY_DB", "lifty.db")
DATABASE_URL = f"sqlite:///{DB_FILE}"

# SQLite with check_same_thread False for simple concurrency in FastAPI
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
