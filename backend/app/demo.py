"""Demo mode: every visitor gets a private, short-lived copy of the app's data.

Each visitor's data lives in its own Postgres schema (demo_<id>), named in the
signed session cookie. Routes still ask for `get_db`; in demo mode main.py
swaps in `get_workspace_db`, which points the session at the visitor's schema
with SQLAlchemy's schema_translate_map (`problems` becomes
`demo_<id>.problems`). Route code doesn't change, and there's no per-query
visitor filter that a new route could forget.
"""

import os
import re
import secrets
from dataclasses import dataclass

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import engine
from app.models import Base

WORKSPACE_KEY = "demo_workspace"
# Schema names go into DDL as identifiers, which can't be bound parameters, so
# only ever accept names this module could have generated.
_SCHEMA_NAME = re.compile(r"demo_[0-9a-f]{16}")


@dataclass(frozen=True)
class DemoConfig:
    enabled: bool
    secret_key: str = ""


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


def workspace_schema(request: Request) -> str:
    """This visitor's schema name, assigning a new one on their first request."""
    schema = request.session.get(WORKSPACE_KEY)
    if not isinstance(schema, str) or not _SCHEMA_NAME.fullmatch(schema):
        schema = f"demo_{secrets.token_hex(8)}"
        request.session[WORKSPACE_KEY] = schema
    return schema


def ensure_workspace(schema: str) -> None:
    with engine.begin() as conn:
        # A page load fires several requests at once; the lock makes the
        # others wait for the first to finish creating the tables.
        conn.execute(text("SELECT pg_advisory_xact_lock(hashtext(:s))"), {"s": schema})
        conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
        Base.metadata.create_all(conn.execution_options(schema_translate_map={None: schema}))


def get_workspace_db(request: Request):
    """Demo stand-in for `get_db`: a session scoped to the visitor's schema."""
    schema = workspace_schema(request)
    ensure_workspace(schema)
    # Set on the bind, not the session's connection, so it survives the new
    # connection a session takes after each commit.
    bind = engine.execution_options(schema_translate_map={None: schema})
    with Session(bind) as session:
        yield session
