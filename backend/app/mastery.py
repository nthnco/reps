"""Per-pattern mastery, as pure functions over problems and their attempts.

Like the scheduler, nothing is stored: mastery is recomputed from the attempt
history on every read, so backdated attempts land in the right order. Decay is
applied at read time through a scheduler's retention function, which this
module calls but never inspects: switching schedulers means passing a
different retention_fn and the matching states.
"""

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from statistics import mean, median
from typing import Protocol

from app import mastery_config as cfg
from app.models import Difficulty, Pattern
from app.scheduling import RetentionFn


class AttemptLike(Protocol):
    id: int
    attempted_on: date
    solved: bool
    duration_seconds: int
    used_hint: bool


class ProblemLike(Protocol):
    pattern: Pattern
    difficulty: Difficulty

    # Read-only, so a list of any attempt-shaped type matches (a plain attribute
    # would be invariant: it must accept writes of any AttemptLike).
    @property
    def attempts(self) -> Sequence[AttemptLike]: ...


@dataclass(frozen=True)
class MasteryState:
    mastery: float = 0.0
    peak: float = 0.0  # all-time best mastery; never decays
    attempt_count: int = 0


@dataclass(frozen=True)
class PatternMastery:
    pattern: Pattern
    mastery: float  # raw, before decay; 0.0 when there are no attempts
    peak: float
    attempt_count: int
    problems_attempted: int  # distinct problems with at least one attempt
    certainty: float
    last_practiced_on: date | None
    median_solve_seconds: int | None  # None: nothing in the pattern solved yet


@dataclass(frozen=True)
class RatingPart:
    pattern: Pattern
    weight: float
    displayed_mastery: float
    counted: bool  # enough problems attempted to count toward the overall rating


@dataclass(frozen=True)
class ProfileSummary:
    overall: float  # weighted mean of displayed mastery over counted patterns; 0 if none
    breakdown: tuple[RatingPart, ...]
    strengths: tuple[Pattern, ...]
    weaknesses: tuple[Pattern, ...]  # weakest attempted patterns below MASTERED_AT
    not_started: tuple[Pattern, ...]
    total_completed: int  # distinct problems solved at least once


def attempt_score(
    solved: bool, used_hint: bool, duration_seconds: int, difficulty: Difficulty
) -> float:
    if not solved:
        return cfg.SCORE_FAILED
    if used_hint or duration_seconds > cfg.SLOW_AFTER_SECONDS[difficulty]:
        return cfg.SCORE_HINT_OR_SLOW
    return cfg.SCORE_CLEAN


def ewma(old: float, new: float, alpha: float = cfg.EWMA_ALPHA) -> float:
    return alpha * new + (1 - alpha) * old


def record(state: MasteryState, score: float) -> MasteryState:
    """Fold one attempt score into the state. The first attempt sets mastery outright."""
    mastery = score if state.attempt_count == 0 else ewma(state.mastery, score)
    return MasteryState(mastery, max(state.peak, mastery), state.attempt_count + 1)


def certainty(n: int) -> float:
    return n / (n + cfg.CERTAINTY_K)


def _latest_solved(attempts: Iterable[AttemptLike]) -> AttemptLike | None:
    return max(
        (a for a in attempts if a.solved),
        key=lambda a: (a.attempted_on, a.id),
        default=None,
    )


def pattern_mastery(problems: Iterable[ProblemLike]) -> list[PatternMastery]:
    """One row per pattern, in Pattern's order, including patterns with no problems."""
    by_pattern: dict[Pattern, list[ProblemLike]] = {p: [] for p in Pattern}
    for problem in problems:
        by_pattern[problem.pattern].append(problem)

    rows = []
    for pattern, group in by_pattern.items():
        # Every attempt in the pattern, oldest first; same-day ones in logged order.
        timeline = sorted(
            ((a, p.difficulty) for p in group for a in p.attempts),
            key=lambda pair: (pair[0].attempted_on, pair[0].id),
        )
        state = MasteryState()
        for a, difficulty in timeline:
            score = attempt_score(a.solved, a.used_hint, a.duration_seconds, difficulty)
            state = record(state, score)

        solve_times = [
            a.duration_seconds for p in group if (a := _latest_solved(p.attempts))
        ]
        rows.append(
            PatternMastery(
                pattern=pattern,
                mastery=state.mastery,
                peak=state.peak,
                attempt_count=state.attempt_count,
                problems_attempted=sum(1 for p in group if p.attempts),
                certainty=certainty(state.attempt_count),
                last_practiced_on=timeline[-1][0].attempted_on if timeline else None,
                median_solve_seconds=round(median(solve_times)) if solve_times else None,
            )
        )
    return rows


def displayed_mastery[S](
    mastery: float, states: Sequence[S], retention_fn: RetentionFn[S], now: date
) -> float:
    """Raw mastery times the average retention of the pattern's problems, floored.

    `states` are the scheduler states of the pattern's attempted problems.
    """
    if not states:
        return mastery
    retention = mean(retention_fn(state, now) for state in states)
    return mastery * max(cfg.RETENTION_FLOOR, retention)


def total_completed(problems: Iterable[ProblemLike]) -> int:
    return sum(1 for p in problems if any(a.solved for a in p.attempts))


def profile_summary(
    rows: Sequence[PatternMastery],
    displayed: Mapping[Pattern, float],
    completed: int,
    weights: Mapping[Pattern, float] = cfg.PATTERN_WEIGHTS,
) -> ProfileSummary:
    breakdown = tuple(
        RatingPart(
            row.pattern,
            weights[row.pattern],
            displayed[row.pattern],
            counted=row.problems_attempted >= cfg.OVERALL_MIN_PROBLEMS,
        )
        for row in rows
    )
    counted = [part for part in breakdown if part.counted]
    total_weight = sum(part.weight for part in counted)
    overall = (
        sum(part.weight * part.displayed_mastery for part in counted) / total_weight
        if total_weight
        else 0.0
    )

    # sorted() is stable, so ties keep Pattern's order.
    attempted = [row for row in rows if row.attempt_count > 0]
    strengths = tuple(
        row.pattern
        for row in sorted(attempted, key=lambda r: -displayed[r.pattern])
        if row.certainty >= cfg.MIN_CERTAINTY
        and displayed[row.pattern] >= cfg.MASTERED_AT
    )[: cfg.SUMMARY_TOP_N]
    weaknesses = tuple(
        row.pattern
        for row in sorted(attempted, key=lambda r: displayed[r.pattern])
        if displayed[row.pattern] < cfg.MASTERED_AT
    )[: cfg.SUMMARY_TOP_N]

    return ProfileSummary(
        overall=overall,
        breakdown=breakdown,
        strengths=strengths,
        weaknesses=weaknesses,
        not_started=tuple(row.pattern for row in rows if row.attempt_count == 0),
        total_completed=completed,
    )
