"""The NeetCode 150 preload migration. These read the real migrated database
(not the emptied `db` fixture), and the up/down test commits, so it restores
the table to its migrated state at the end."""

import importlib.util

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.db import engine
from app.models import Difficulty, Pattern
from app.schemas import normalize_leetcode_link
from tests.conftest import ALEMBIC_INI

# Loaded by path: the backend's alembic/ folder isn't an importable package
# (the name belongs to the alembic library).
_spec = importlib.util.spec_from_file_location(
    "preload", ALEMBIC_INI.parent / "alembic/versions/e4d957687cae_preload_neetcode_150.py"
)
assert _spec and _spec.loader
preload = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(preload)
PREVIOUS = preload.down_revision
ALL_LINKS = [preload._link(slug) for _, entries in preload.NEETCODE_150 for slug, _, _ in entries]


def rows():
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT id, title, link, pattern, difficulty, notes FROM problems ORDER BY id")
        ).all()


def test_data_is_150_unique_valid_problems():
    entries = [(p, *e) for p, es in preload.NEETCODE_150 for e in es]

    assert len(entries) == 150
    assert len(set(ALL_LINKS)) == 150
    for pattern, slug, title, difficulty in entries:
        assert Pattern(pattern) and Difficulty(difficulty) and title
        assert normalize_leetcode_link(preload._link(slug)) == preload._link(slug)
    # Patterns appear in roadmap order, each once.
    assert [p for p, _ in preload.NEETCODE_150] == list(Pattern)


def test_migration_inserted_them_in_neetcode_order(migrated_db):
    assert [row.link for row in rows()] == ALL_LINKS


def test_upgrade_keeps_existing_rows_and_downgrade_removes_only_untouched_ones(migrated_db):
    config = Config(str(ALEMBIC_INI))
    try:
        command.downgrade(config, PREVIOUS)
        assert rows() == []

        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO problems (title, link, pattern, difficulty, notes) VALUES "
                    "('My Two Sum', 'https://leetcode.com/problems/two-sum/', 'arrays_hashing', 'easy', 'hash map'),"
                    "('Coin Change', 'https://leetcode.com/problems/coin-change/', 'dp_1d', 'medium', ''),"
                    "('Mine', 'https://leetcode.com/problems/not-in-the-150/', 'stack', 'easy', '')"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO attempts (problem_id, attempted_on, solved, duration_seconds, confidence) "
                    "SELECT id, '2026-10-01', true, 600, 3 FROM problems WHERE title = 'Coin Change'"
                )
            )

        command.upgrade(config, "head")
        after_upgrade = rows()
        assert len(after_upgrade) == 151
        # The user's own row wins: same id, title and notes.
        two_sum = next(r for r in after_upgrade if r.link.endswith("/two-sum/"))
        assert (two_sum.title, two_sum.notes) == ("My Two Sum", "hash map")

        command.downgrade(config, PREVIOUS)
        # Kept: has notes, has an attempt, not in the 150.
        assert sorted(r.title for r in rows()) == ["Coin Change", "Mine", "My Two Sum"]
    finally:
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM problems"))
        command.upgrade(config, "head")
