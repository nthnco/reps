"""SM-2 style review scheduling, as pure functions over a problem's attempts.

Nothing here touches the database: the due date is recomputed by replaying a
problem's attempt history, so it can't drift out of sync with the attempts.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Protocol

# Ease is kept in hundredths (250 means 2.5) so interval math is exact integer
# arithmetic. With floats, ceil(25 * 2.2) is 56, not 55.
INITIAL_EASE = 250
MIN_EASE = 130
PASSING_QUALITY = 3


class AttemptLike(Protocol):
    attempted_on: date
    solved: bool
    confidence: int
    used_hint: bool


@dataclass(frozen=True)
class ReviewState:
    repetitions: int  # successful reviews in a row; a lapse resets it to 0
    interval_days: int
    ease: int  # hundredths
    due_on: date


def quality(solved: bool, confidence: int, used_hint: bool) -> int:
    """Map an attempt to SM-2's 0-5 quality, where 3 and up counts as a pass."""
    if not solved:
        return 1
    if used_hint:
        return min(confidence, PASSING_QUALITY)
    return confidence


def review(state: ReviewState | None, q: int, on: date) -> ReviewState:
    """Apply one review of quality q, done on `on`, to the previous state."""
    if not 0 <= q <= 5:
        raise ValueError(f"quality must be 0-5, got {q}")
    if state is None:
        state = ReviewState(repetitions=0, interval_days=0, ease=INITIAL_EASE, due_on=on)

    if q < PASSING_QUALITY:
        repetitions, interval = 0, 1
    elif state.repetitions == 0:
        repetitions, interval = 1, 1
    elif state.repetitions == 1:
        repetitions, interval = 2, 6
    else:
        repetitions = state.repetitions + 1
        interval = -(-state.interval_days * state.ease // 100)  # ceiling division

    # SM-2's EF' = EF + 0.1 - (5-q)(0.08 + (5-q)0.02), scaled by 100.
    miss = 5 - q
    ease = max(MIN_EASE, state.ease + 10 - miss * (8 + miss * 2))

    return ReviewState(repetitions, interval, ease, on + timedelta(days=interval))


def schedule(attempts: Iterable[AttemptLike]) -> ReviewState | None:
    """Replay attempts in date order. None means the problem was never attempted."""
    state = None
    # sorted() is stable, so same-day attempts keep the order they were given in.
    for a in sorted(attempts, key=lambda a: a.attempted_on):
        state = review(state, quality(a.solved, a.confidence, a.used_hint), a.attempted_on)
    return state
