from datetime import date, timedelta

import pytest
from sqlalchemy import delete, func, select

from app.clock import local_today
from app.models import Attempt, Difficulty, Pattern, Problem
from app.routes import mastery as mastery_routes
from app.routes import queue as queue_routes
from app.routes.mastery import build_pattern_mastery
from app.routes.queue import build_queue

AS_OF = local_today() - timedelta(days=10)


def add(db, slug: str, *days: int, pattern: Pattern = Pattern.STACK) -> None:
    """A problem with one clean solve on each day, given as offsets from AS_OF."""
    problem = Problem(
        title=slug,
        link=f"https://leetcode.com/problems/{slug}/",
        pattern=pattern,
        difficulty=Difficulty.MEDIUM,
    )
    problem.attempts = [
        Attempt(
            attempted_on=AS_OF + timedelta(days=d),
            solved=True,
            duration_seconds=600,
            confidence=4,
        )
        for d in days
    ]
    db.add(problem)
    db.flush()


@pytest.fixture
def history(db):
    add(db, "before-on-and-after", -6, -1, 0, 3)
    add(db, "only-before", -3, pattern=Pattern.TREES)
    add(db, "only-after", 2)
    add(db, "never-attempted")


def attempt_count(db) -> int:
    return db.scalar(select(func.count()).select_from(Attempt))


def freeze_today(monkeypatch, day: date) -> None:
    monkeypatch.setattr(queue_routes, "local_today", lambda: day)
    monkeypatch.setattr(mastery_routes, "local_today", lambda: day)


def test_as_of_equals_live_view_of_earlier_attempts(db, history, monkeypatch):
    queue = build_queue(db, AS_OF)
    mastery = build_pattern_mastery(db, AS_OF)

    db.execute(delete(Attempt).where(Attempt.attempted_on >= AS_OF))
    db.expire_all()
    freeze_today(monkeypatch, AS_OF)

    assert build_queue(db) == queue
    assert build_pattern_mastery(db) == mastery
    # Guard against a vacuous pass: the later attempts did change the live view.
    assert {item.problem.title for item in queue if item.due_on is None} == {
        "never-attempted",
        "only-after",
    }


def test_attempts_on_as_of_day_are_ignored(db, history):
    queue = build_queue(db, AS_OF)
    mastery = build_pattern_mastery(db, AS_OF)

    problem = db.scalar(select(Problem).where(Problem.title == "only-before"))
    problem.attempts.append(
        Attempt(attempted_on=AS_OF, solved=False, duration_seconds=600, confidence=1)
    )
    db.flush()

    assert build_queue(db, AS_OF) == queue
    assert build_pattern_mastery(db, AS_OF) == mastery


def test_as_of_leaves_stored_attempts_alone(db, history):
    before = attempt_count(db)

    build_queue(db, AS_OF)
    build_pattern_mastery(db, AS_OF)
    db.flush()

    assert attempt_count(db) == before
