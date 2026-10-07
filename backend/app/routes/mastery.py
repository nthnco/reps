"""Pattern mastery and the profile summary, computed on read.

This is where a scheduler is plugged into the mastery code: `schedule` builds
each problem's state and `retention` decays mastery. Switching to FSRS means
importing those two from fsrs instead.
"""

from collections import Counter
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import mastery_config as cfg
from app.clock import local_today
from app.db import get_db
from app.mastery import (
    PatternMastery,
    displayed_mastery,
    pattern_mastery,
    profile_summary,
    total_completed,
)
from app.models import Pattern, Problem
from app.schemas import PatternMasteryRead, ProfileSummaryRead
from app.sm2 import ReviewState, retention, schedule

router = APIRouter(prefix="/api", tags=["mastery"])


def _load_problems(db: Session) -> list[Problem]:
    return list(db.scalars(select(Problem).options(selectinload(Problem.attempts))))


def _states_by_pattern(problems: list[Problem]) -> dict[Pattern, list[ReviewState]]:
    """Scheduler state of every attempted problem, grouped by pattern."""
    states: dict[Pattern, list[ReviewState]] = {p: [] for p in Pattern}
    for problem in problems:
        # Same Mapped[...] false positive as in queue.py.
        state = schedule(problem.attempts)  # pyright: ignore[reportArgumentType]
        if state is not None:
            states[problem.pattern].append(state)
    return states


def _displayed(
    rows: list[PatternMastery], states: dict[Pattern, list[ReviewState]], today: date
) -> dict[Pattern, float]:
    return {
        row.pattern: displayed_mastery(row.mastery, states[row.pattern], retention, today)
        for row in rows
    }


@router.get("/patterns/mastery", response_model=list[PatternMasteryRead])
def get_pattern_mastery(db: Annotated[Session, Depends(get_db)]) -> list[PatternMasteryRead]:
    """One row per pattern, in the fixed pattern order, including untouched ones."""
    today = local_today()
    problems = _load_problems(db)
    rows = pattern_mastery(problems)  # pyright: ignore[reportArgumentType]
    states = _states_by_pattern(problems)
    displayed = _displayed(rows, states, today)
    problem_counts = Counter(p.pattern for p in problems)

    return [
        PatternMasteryRead(
            pattern=row.pattern,
            displayed_mastery=displayed[row.pattern],
            mastery=row.mastery,
            peak=row.peak,
            certainty=row.certainty,
            low_data=row.certainty < cfg.MIN_CERTAINTY,
            attempt_count=row.attempt_count,
            problem_count=problem_counts[row.pattern],
            due_count=sum(1 for s in states[row.pattern] if s.due_on <= today),
            last_practiced_on=row.last_practiced_on,
            median_solve_seconds=row.median_solve_seconds,
        )
        for row in rows
    ]


@router.get("/profile/summary", response_model=ProfileSummaryRead)
def get_profile_summary(db: Annotated[Session, Depends(get_db)]) -> ProfileSummaryRead:
    today = local_today()
    problems = _load_problems(db)
    rows = pattern_mastery(problems)  # pyright: ignore[reportArgumentType]
    displayed = _displayed(rows, _states_by_pattern(problems), today)
    completed = total_completed(problems)  # pyright: ignore[reportArgumentType]
    return ProfileSummaryRead.model_validate(profile_summary(rows, displayed, completed))
