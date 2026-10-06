import datetime as dt

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.models import Attempt, Difficulty, Pattern, Problem


def make_problem(**overrides) -> Problem:
    fields = dict(
        title="Two Sum",
        link="https://leetcode.com/problems/two-sum/",
        pattern=Pattern.ARRAYS_HASHING,
        difficulty=Difficulty.EASY,
    )
    return Problem(**(fields | overrides))


def make_attempt(**overrides) -> Attempt:
    fields = dict(
        attempted_on=dt.date(2026, 10, 3),
        solved=True,
        duration_seconds=900,
        confidence=4,
    )
    return Attempt(**(fields | overrides))


def insert_problem_sql(db, **overrides) -> None:
    # Raw SQL skips the Python enums, so only the database's own rules apply.
    fields = dict(
        title="Two Sum",
        link="https://leetcode.com/problems/two-sum/",
        pattern="arrays_hashing",
        difficulty="easy",
    ) | overrides
    db.execute(
        text(
            "INSERT INTO problems (title, link, pattern, difficulty) "
            "VALUES (:title, :link, :pattern, :difficulty)"
        ),
        fields,
    )


def test_problem_with_attempt_round_trips(db):
    problem = make_problem()
    problem.attempts.append(make_attempt())
    db.add(problem)
    db.flush()
    db.expire_all()  # force a fresh read from the database

    loaded = db.get(Problem, problem.id)
    assert loaded.pattern is Pattern.ARRAYS_HASHING
    assert loaded.notes == ""
    assert len(loaded.attempts) == 1
    assert loaded.attempts[0].used_hint is False


def test_enums_are_stored_as_lowercase_values(db):
    db.add(make_problem(pattern=Pattern.DP_1D, difficulty=Difficulty.HARD))
    db.flush()

    row = db.execute(text("SELECT pattern, difficulty FROM problems")).one()
    assert tuple(row) == ("dp_1d", "hard")


@pytest.mark.parametrize(
    ("overrides", "constraint"),
    [
        ({"pattern": "union_find"}, "ck_problems_pattern"),
        ({"difficulty": "impossible"}, "ck_problems_difficulty"),
    ],
)
def test_database_rejects_bad_problem(db, overrides, constraint):
    with pytest.raises(IntegrityError, match=constraint):
        insert_problem_sql(db, **overrides)


def test_database_rejects_duplicate_problem_link(db):
    insert_problem_sql(db)
    with pytest.raises(IntegrityError, match="uq_problems_link"):
        insert_problem_sql(db, title="Same link again")


@pytest.mark.parametrize(
    ("overrides", "constraint"),
    [
        ({"confidence": 0}, "ck_attempts_confidence_range"),
        ({"confidence": 6}, "ck_attempts_confidence_range"),
        ({"duration_seconds": -1}, "ck_attempts_duration_nonnegative"),
    ],
)
def test_database_rejects_bad_attempt(db, overrides, constraint):
    problem = make_problem()
    problem.attempts.append(make_attempt(**overrides))
    db.add(problem)
    with pytest.raises(IntegrityError, match=constraint):
        db.flush()


def test_deleting_problem_deletes_its_attempts(db):
    problem = make_problem()
    problem.attempts.append(make_attempt())
    db.add(problem)
    db.flush()

    # Delete in raw SQL to prove the database-level ON DELETE CASCADE works on
    # its own, not just SQLAlchemy's Python-side cascade.
    db.execute(text("DELETE FROM problems"))
    assert db.scalar(select(func.count()).select_from(Attempt)) == 0
