import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+psycopg://reps:reps@localhost:5432/reps"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(engine)


def get_db():
    """FastAPI dependency: one session per request, always closed afterward."""
    with SessionLocal() as session:
        yield session
