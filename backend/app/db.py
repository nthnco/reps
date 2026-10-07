import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def normalize_database_url(url: str) -> str:
    """Point plain Postgres URLs (as hosts like Neon hand them out) at psycopg 3.

    SQLAlchemy reads `postgresql://` as "use psycopg2", which isn't installed.
    """
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url.removeprefix(prefix)
    return url


DATABASE_URL = normalize_database_url(
    os.environ.get("DATABASE_URL", "postgresql+psycopg://reps:reps@localhost:5432/reps")
)

# pre_ping checks each pooled connection before use. Neon suspends idle
# databases, which silently kills open connections; without this the first
# request after a suspend would fail.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(engine)


def get_db():
    """FastAPI dependency: one session per request, always closed afterward."""
    with SessionLocal() as session:
        yield session
