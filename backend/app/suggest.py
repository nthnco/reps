"""Next-pattern suggestion: where new material should come from, as a pure function.

A nudge, not a gate (TREE.md branch 7). Everything here counts distinct
problems and solves, never mastery or retention, so a long break or newly
added problems can't un-cover a pattern. "No hint" means only that: no time
limit, unlike mastery's `is_clean()`.
"""

import enum
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from typing import Protocol

from app.models import Difficulty, Pattern

COVERED_MEDIUMS = 2  # different mediums solved, hints allowed; one must be hint-free
EASIES_BEFORE_MEDIUM = 2  # different easies solved, or one solved without a hint

LEVELS = (Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD)
TIERS = (Difficulty.EASY, Difficulty.MEDIUM)  # hards only once no new medium is left anywhere


class AttemptLike(Protocol):
    id: int
    attempted_on: date
    solved: bool
    used_hint: bool


class ProblemLike(Protocol):
    id: int
    pattern: Pattern
    difficulty: Difficulty

    @property
    def attempts(self) -> Sequence[AttemptLike]: ...


class Reason(enum.StrEnum):
    START_EASY = "start_easy"  # not covered; still on easies
    NEXT_MEDIUM = "next_medium"  # not covered; on mediums
    STEP_BACK = "step_back"  # last two attempts failed; an easier problem
    KEEP_REVIEWING = "keep_reviewing"  # not covered, but nothing new left in it
    DEEPEN = "deepen"  # every pattern covered; the weakest one's next medium, then hard


@dataclass(frozen=True)
class Suggestion[P]:
    pattern: Pattern
    problem: P | None  # None only with KEEP_REVIEWING
    reason: Reason


def _solved_count(group: Iterable[ProblemLike], difficulty: Difficulty, *, no_hint: bool = False) -> int:
    """Distinct problems of this difficulty solved at least once (without a hint, if asked)."""
    return sum(
        1
        for p in group
        if p.difficulty == difficulty
        and any(a.solved and not (no_hint and a.used_hint) for a in p.attempts)
    )


def is_covered(group: Sequence[ProblemLike]) -> bool:
    return (
        _solved_count(group, Difficulty.MEDIUM) >= COVERED_MEDIUMS
        and _solved_count(group, Difficulty.MEDIUM, no_hint=True) >= 1
    )


def _by_pattern[P: ProblemLike](problems: Iterable[P]) -> dict[Pattern, list[P]]:
    groups: dict[Pattern, list[P]] = {p: [] for p in Pattern}
    for problem in problems:
        groups[problem.pattern].append(problem)
    return groups


def covered_patterns(problems: Iterable[ProblemLike]) -> dict[Pattern, bool]:
    return {pattern: is_covered(group) for pattern, group in _by_pattern(problems).items()}


def _last_two_failed(group: Sequence[ProblemLike]) -> Difficulty | None:
    """The last attempted problem's difficulty if the pattern's last two attempts failed."""
    timeline = sorted(
        ((a, p.difficulty) for p in group for a in p.attempts),
        key=lambda pair: (pair[0].attempted_on, pair[0].id),
    )
    if len(timeline) >= 2 and not timeline[-1][0].solved and not timeline[-2][0].solved:
        return timeline[-1][1]
    return None


def _tier(group: Sequence[ProblemLike]) -> tuple[Difficulty, Difficulty | None]:
    """The tier to pick from, and the last difficulty if this is a step back."""
    lowest = next(
        (d for d in TIERS if any(p.difficulty == d for p in group)), Difficulty.MEDIUM
    )
    if (failed_at := _last_two_failed(group)) is not None:
        stepped = LEVELS[max(LEVELS.index(failed_at) - 1, 0)]
        return max(stepped, lowest, key=LEVELS.index), failed_at
    if lowest == Difficulty.EASY and not (
        _solved_count(group, Difficulty.EASY, no_hint=True) >= 1
        or _solved_count(group, Difficulty.EASY) >= EASIES_BEFORE_MEDIUM
    ):
        return Difficulty.EASY, None
    return Difficulty.MEDIUM, None


def _first_new[P: ProblemLike](group: Sequence[P], tier: Difficulty) -> P | None:
    """Lowest-id never-attempted problem at `tier`, moving up a tier (to medium) if none."""
    for difficulty in TIERS[TIERS.index(tier) :]:
        fresh = [p for p in group if p.difficulty == difficulty and not p.attempts]
        if fresh:
            return min(fresh, key=lambda p: p.id)
    return None


def suggest[P: ProblemLike](
    problems: Iterable[P], raw_mastery: Mapping[Pattern, float]
) -> Suggestion[P] | None:
    """The next new problem to try. None once every pattern is covered and nothing new is left.

    `raw_mastery` (before decay) only matters once every pattern is covered.
    """
    groups = _by_pattern(problems)

    for pattern, group in groups.items():
        if is_covered(group):
            continue
        tier, failed_at = _tier(group)
        problem = _first_new(group, tier)
        if problem is None:
            return Suggestion(pattern, None, Reason.KEEP_REVIEWING)
        if failed_at is not None and LEVELS.index(problem.difficulty) < LEVELS.index(failed_at):
            reason = Reason.STEP_BACK
        elif problem.difficulty == Difficulty.EASY:
            reason = Reason.START_EASY
        else:
            reason = Reason.NEXT_MEDIUM
        return Suggestion(pattern, problem, reason)

    # Every pattern covered: mediums anywhere first, then hards. sorted() is
    # stable, so mastery ties keep roadmap order.
    weakest_first = sorted(groups, key=lambda p: raw_mastery.get(p, 0.0))
    for difficulty in (Difficulty.MEDIUM, Difficulty.HARD):
        for pattern in weakest_first:
            fresh = [p for p in groups[pattern] if p.difficulty == difficulty and not p.attempts]
            if fresh:
                return Suggestion(pattern, min(fresh, key=lambda p: p.id), Reason.DEEPEN)
    return None
