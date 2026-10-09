"""Demo mode: every visitor gets a private, short-lived copy of the app's data.

Each visitor's data lives in its own Postgres schema (demo_<id>), named in the
signed session cookie. Routes still ask for `get_db`; in demo mode main.py
swaps in `get_workspace_db`, which points the session at the visitor's schema
with SQLAlchemy's schema_translate_map (`problems` becomes
`demo_<id>.problems`). Route code doesn't change, and there's no per-query
visitor filter that a new route could forget.

The demo is meant for a few minutes' look, so the limits are low: a workspace
lasts an hour from creation, at most MAX_WORKSPACES exist (the oldest is
dropped first), and each takes only a handful of new rows. Old workspaces are
cleaned up whenever a new one is made, so no background job is needed.
"""

import os
import re
import secrets
from dataclasses import dataclass
from datetime import timedelta

from fastapi import Request
from sqlalchemy import Connection, event, func, select, text
from sqlalchemy.orm import Session

from app.db import engine
from app.models import Attempt, Base, Problem

WORKSPACE_KEY = "demo_workspace"
LIFETIME = timedelta(hours=1)
MAX_WORKSPACES = 50
MAX_NEW_PROBLEMS = 10
MAX_NEW_ATTEMPTS = 30
# Arbitrary id for the advisory lock that serializes creating and dropping
# workspaces. Creation is rare (once per visitor), so one global lock is fine.
_CREATE_LOCK = 7_340_001

# Schema names go into DDL as identifiers, which can't be bound parameters, so
# only ever accept names this module could have generated.
_SCHEMA_NAME = re.compile(r"demo_[0-9a-f]{16}")


@dataclass(frozen=True)
class DemoConfig:
    enabled: bool
    secret_key: str = ""


@dataclass(frozen=True)
class Baseline:
    """Row counts a workspace started with; the write limits count from here."""

    problems: int
    attempts: int


class DemoLimitReached(Exception):
    pass


def _flag(env, name: str) -> bool:
    return env.get(name, "").lower() in ("1", "true")


def load_demo_config(env=os.environ) -> DemoConfig:
    if not _flag(env, "DEMO_MODE"):
        return DemoConfig(enabled=False)
    if _flag(env, "REQUIRE_LOGIN"):
        raise RuntimeError("DEMO_MODE and REQUIRE_LOGIN can't both be on: the demo is public")
    # The cookie says which workspace a visitor owns; an unsigned or guessable
    # key would let anyone point theirs at someone else's.
    if not env.get("SECRET_KEY"):
        raise RuntimeError("DEMO_MODE is set but SECRET_KEY is missing")
    return DemoConfig(enabled=True, secret_key=env["SECRET_KEY"])


def setup_registry() -> None:
    """Create the table that tracks workspaces. Safe to run on every start."""
    with engine.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS demo_meta"))
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS demo_meta.workspaces (
                    schema_name text PRIMARY KEY,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    base_problems int NOT NULL,
                    base_attempts int NOT NULL
                )
                """
            )
        )


def workspace_schema(request: Request) -> str:
    """This visitor's schema name, assigning a new one on their first request."""
    schema = request.session.get(WORKSPACE_KEY)
    if not isinstance(schema, str) or not _SCHEMA_NAME.fullmatch(schema):
        schema = f"demo_{secrets.token_hex(8)}"
        request.session[WORKSPACE_KEY] = schema
    return schema


_LIVE = text(
    """
    SELECT base_problems, base_attempts FROM demo_meta.workspaces
    WHERE schema_name = :schema AND created_at > now() - :lifetime
    """
)


def _live_baseline(conn: Connection, schema: str) -> Baseline | None:
    row = conn.execute(_LIVE, {"schema": schema, "lifetime": LIFETIME}).one_or_none()
    return Baseline(*row) if row else None


def _drop(conn: Connection, schemas: list[str]) -> None:
    if not schemas:
        return
    for schema in schemas:
        conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
    conn.execute(
        text("DELETE FROM demo_meta.workspaces WHERE schema_name = ANY(:schemas)"),
        {"schemas": schemas},
    )


def _drop_stale(conn: Connection) -> None:
    """Drop expired workspaces, and the oldest ones beyond room for one more."""
    stale = conn.scalars(
        text(
            """
            SELECT schema_name FROM demo_meta.workspaces
            WHERE created_at <= now() - :lifetime
            UNION
            (SELECT schema_name FROM demo_meta.workspaces
             ORDER BY created_at DESC OFFSET :keep)
            """
        ),
        {"lifetime": LIFETIME, "keep": MAX_WORKSPACES - 1},
    ).all()
    _drop(conn, list(stale))


def ensure_workspace(schema: str) -> Baseline:
    """Make sure the visitor has a live workspace, creating a fresh one if not."""
    with engine.begin() as conn:
        if baseline := _live_baseline(conn, schema):
            return baseline
        conn.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _CREATE_LOCK})
        # A page load fires several requests at once; the others waited on the
        # lock while the first one created it.
        if baseline := _live_baseline(conn, schema):
            return baseline
        _drop_stale(conn)
        # Also clears anything left of an expired or half-made one by this name.
        _drop(conn, [schema])
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        Base.metadata.create_all(conn.execution_options(schema_translate_map={None: schema}))
        baseline = Baseline(problems=0, attempts=0)
        conn.execute(
            text(
                """
                INSERT INTO demo_meta.workspaces (schema_name, base_problems, base_attempts)
                VALUES (:schema, :problems, :attempts)
                """
            ),
            {"schema": schema, "problems": baseline.problems, "attempts": baseline.attempts},
        )
        return baseline


def _enforce_limits(session: Session, baseline: Baseline) -> None:
    """Refuse a flush that would take the workspace past its new-row limits.

    Checked on flush rather than per route, so any future route that adds rows
    is limited too. Two writes racing at the limit can both get through, which
    only overshoots by one.
    """

    @event.listens_for(session, "before_flush")
    def check(session: Session, flush_context, instances) -> None:
        for model, base, limit, noun in (
            (Problem, baseline.problems, MAX_NEW_PROBLEMS, "problems"),
            (Attempt, baseline.attempts, MAX_NEW_ATTEMPTS, "attempts"),
        ):
            adding = sum(isinstance(obj, model) for obj in session.new)
            if not adding:
                continue
            existing = session.scalar(select(func.count()).select_from(model)) or 0
            if existing + adding > base + limit:
                raise DemoLimitReached(
                    f"The demo allows up to {limit} new {noun}. It resets after an hour."
                )


def get_workspace_db(request: Request):
    """Demo stand-in for `get_db`: a session scoped to the visitor's schema."""
    schema = workspace_schema(request)
    baseline = ensure_workspace(schema)
    # Set on the bind, not the session's connection, so it survives the new
    # connection a session takes after each commit.
    bind = engine.execution_options(schema_translate_map={None: schema})
    with Session(bind) as session:
        _enforce_limits(session, baseline)
        yield session
