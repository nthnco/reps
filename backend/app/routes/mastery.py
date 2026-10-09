"""Pattern mastery and the profile summary, computed on read.

This is where a scheduler is plugged into the mastery code: `schedule` builds
each problem's state and `retention` decays mastery. Switching to FSRS means
importing those two from fsrs instead.
"""

from collections import Counter
from dataclasses import asdict
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import mastery_config as cfg
from app.clock import local_today
from app.db import get_db
from app.mastery import (
    PatternMastery,
    attempts_to_trust,
    displayed_mastery,
    pattern_mastery,
    profile_summary,
    total_completed,
)
from app.models import Difficulty, Pattern
from app.schemas import (
    MasteryRulesRead,
    PatternMasteryRead,
    ProblemRead,
    ProfileSummaryRead,
    SuggestionRead,
    TierCountsRead,
)
from app.sm2 import ReviewState, retention, schedule
from app.snapshot import ProblemSnapshot, load_problems
from app.suggest import covered_patterns, suggest, tier_counts

router = APIRouter(prefix="/api", tags=["mastery"])


def _states_by_pattern(problems: list[ProblemSnapshot]) -> dict[Pattern, list[ReviewState]]:
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


def _tier_read(counts: dict[Difficulty, int]) -> TierCountsRead:
    return TierCountsRead(**{d.value: n for d, n in counts.items()})


@router.get("/patterns/mastery",response_model=list[PatternMasteryRead])
def get_pattern_mastery(db: Annotated[Session, Depends(get_db)]) -> list[PatternMasteryRead]:
    """One row per pattern, in the fixed pattern order, including untouched ones."""
    return build_pattern_mastery(db)


def build_pattern_mastery(db: Session, as_of: date | None = None) -> list[PatternMasteryRead]:
    """Mastery as it stood at the start of `as_of` (default: live, as of now)."""
    today = as_of or local_today()
    problems = load_problems(db, as_of)
    rows = pattern_mastery(problems)  # pyright: ignore[reportArgumentType]
    states = _states_by_pattern(problems)
    displayed = _displayed(rows, states, today)
    problem_counts = Counter(p.pattern for p in problems)
    covered = covered_patterns(problems)  # pyright: ignore[reportArgumentType]
    tiers = tier_counts(problems)  # pyright: ignore[reportArgumentType]

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
            problems_attempted=row.problems_attempted,
            problems_until_counted=max(0, cfg.OVERALL_MIN_PROBLEMS - row.problems_attempted),
            attempts_until_trusted=max(0, attempts_to_trust() - row.attempt_count),
            due_count=sum(1 for s in states[row.pattern] if s.due_on <= today),
            last_practiced_on=row.last_practiced_on,
            median_solve_seconds=row.median_solve_seconds,
            covered=covered[row.pattern],
            solved_by_tier=_tier_read(tiers[row.pattern].solved),
            total_by_tier=_tier_read(tiers[row.pattern].total),
        )
        for row in rows
    ]


@router.get("/patterns/suggestion", response_model=SuggestionRead | None)
def get_suggestion(db: Annotated[Session, Depends(get_db)]) -> SuggestionRead | None:
    """Where to pick up new material; null once nothing new is left anywhere."""
    return build_suggestion(db)


def build_suggestion(db: Session, as_of: date | None = None) -> SuggestionRead | None:
    """The suggestion as it stood at the start of `as_of` (default: live, as of now)."""
    problems = load_problems(db, as_of)
    rows = pattern_mastery(problems)  # pyright: ignore[reportArgumentType]
    raw_mastery = {row.pattern: row.mastery for row in rows}
    suggestion = suggest(problems, raw_mastery)  # pyright: ignore[reportArgumentType]
    if suggestion is None:
        return None
    problem = suggestion.problem
    return SuggestionRead(
        pattern=suggestion.pattern,
        problem=ProblemRead.model_validate(problem) if problem else None,
        reason=suggestion.reason,
    )


@router.get("/profile/summary", response_model=ProfileSummaryRead)
def get_profile_summary(db: Annotated[Session, Depends(get_db)]) -> ProfileSummaryRead:
    today = local_today()
    problems = load_problems(db)
    rows = pattern_mastery(problems)  # pyright: ignore[reportArgumentType]
    displayed = _displayed(rows, _states_by_pattern(problems), today)
    completed = total_completed(problems)  # pyright: ignore[reportArgumentType]
    summary = profile_summary(rows, displayed, completed)
    rules = MasteryRulesRead(
        overall_min_problems=cfg.OVERALL_MIN_PROBLEMS,
        mastered_at=cfg.MASTERED_AT,
        strength_min_attempts=attempts_to_trust(),
    )
    return ProfileSummaryRead(rules=rules, **asdict(summary))
