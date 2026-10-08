"""FSRS-6 review scheduling, as pure functions over a problem's attempts.

FSRS models memory with two numbers per problem: stability (days until recall
drops to 90%) and difficulty (1-10, how hard stability is to grow). Recall
probability decays along a power curve, and the next review is set for the day
it's predicted to hit DESIRED_RETENTION.

Formulas and default parameters follow the reference implementation, py-fsrs
6.3.2 (github.com/open-spaced-repetition/py-fsrs), minus its minute-level
learning steps and interval fuzzing: attempts here are calendar dates.
"""

import math
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Protocol

from app.scheduling import RetentionFn, UpdateFn

AGAIN, HARD, GOOD, EASY = 1, 2, 3, 4

# w[0]..w[20]. Fit by the FSRS authors on millions of Anki reviews; a later
# piece of this leaf may refit some of them on the user's own history.
W = (
    0.212, 1.2931, 2.3065, 8.2956,  # initial stability for Again/Hard/Good/Easy
    6.4133, 0.8334,  # initial difficulty
    3.0194, 0.001,  # difficulty change per rating, mean reversion
    1.8722, 0.1666, 0.796,  # stability growth after a recall
    1.4835, 0.0614, 0.2629, 1.6483,  # stability after a lapse
    0.6014, 1.8729,  # Hard penalty, Easy bonus
    0.5425, 0.0912, 0.0658,  # same-day reviews
    0.1542,  # forgetting curve decay
)  # fmt: skip

DESIRED_RETENTION = 0.9
MAX_INTERVAL_DAYS = 36500
MIN_STABILITY = 0.001
MIN_DIFFICULTY, MAX_DIFFICULTY = 1.0, 10.0

DECAY = -W[20]
# Chosen so retention is exactly 0.9 when elapsed days equal stability.
FACTOR = 0.9 ** (1 / DECAY) - 1


class AttemptLike(Protocol):
    attempted_on: date
    solved: bool
    confidence: int
    used_hint: bool


@dataclass(frozen=True)
class ReviewState:
    stability: float  # days
    difficulty: float  # 1-10
    reviewed_on: date
    due_on: date


def rating(solved: bool, confidence: int, used_hint: bool) -> int:
    """Map an attempt to FSRS's 1-4 rating. Any solve, even with a hint, is a recall."""
    if not solved:
        return AGAIN
    if used_hint or confidence <= 2:
        return HARD
    if confidence == 3:
        return GOOD
    return EASY


def _recall_probability(stability: float, elapsed_days: float) -> float:
    return (1 + FACTOR * elapsed_days / stability) ** DECAY


def _initial_difficulty(r: int) -> float:
    return W[4] - math.exp(W[5] * (r - 1)) + 1


def _clamp_difficulty(d: float) -> float:
    return min(max(d, MIN_DIFFICULTY), MAX_DIFFICULTY)


def _next_difficulty(d: float, r: int) -> float:
    delta = -W[6] * (r - 3)
    damped = d + delta * (10 - d) / 9  # changes shrink as d approaches 10
    # Pull slightly back towards the initial Easy difficulty so d can't stick at 10.
    return _clamp_difficulty(W[7] * _initial_difficulty(EASY) + (1 - W[7]) * damped)


def _next_stability(s: float, d: float, retention: float, r: int) -> float:
    if r == AGAIN:
        long_term = W[11] * d ** -W[12] * ((s + 1) ** W[13] - 1) * math.exp(W[14] * (1 - retention))
        # A lapse never leaves stability higher than a same-day Again would.
        return min(long_term, s / math.exp(W[17] * W[18]))
    hard_penalty = W[15] if r == HARD else 1
    easy_bonus = W[16] if r == EASY else 1
    # Grows more when d is low, s is low, and recall was unlikely (a harder win).
    growth = math.exp(W[8]) * (11 - d) * s ** -W[9] * (math.exp(W[10] * (1 - retention)) - 1)
    return s * (1 + growth * hard_penalty * easy_bonus)


def _same_day_stability(s: float, r: int) -> float:
    increase = math.exp(W[17] * (r - 3 + W[18])) * s ** -W[19]
    if r != AGAIN:
        increase = max(increase, 1.0)
    return s * increase


def _interval_days(stability: float) -> int:
    days = stability / FACTOR * (DESIRED_RETENTION ** (1 / DECAY) - 1)
    return min(max(round(days), 1), MAX_INTERVAL_DAYS)


def update(state: ReviewState | None, rating: int, now: date) -> ReviewState:
    """Apply one review with FSRS rating `rating` (1-4), done on `now`, to the previous state."""
    if not AGAIN <= rating <= EASY:
        raise ValueError(f"rating must be 1-4, got {rating}")

    if state is None:
        stability = W[rating - 1]
        difficulty = _clamp_difficulty(_initial_difficulty(rating))
    else:
        elapsed = (now - state.reviewed_on).days
        if elapsed < 1:
            # Same day (or a backdated attempt before the last one): the
            # forgetting curve hasn't had time to act, so use the short-term rule.
            stability = _same_day_stability(state.stability, rating)
        else:
            recall = _recall_probability(state.stability, elapsed)
            stability = _next_stability(state.stability, state.difficulty, recall, rating)
        difficulty = _next_difficulty(state.difficulty, rating)

    stability = max(stability, MIN_STABILITY)
    return ReviewState(stability, difficulty, now, now + timedelta(days=_interval_days(stability)))


def retention(state: ReviewState, now: date) -> float:
    """Predicted recall on `now`. 1.0 on the review day, 0.9 after `stability` days."""
    elapsed = max(0, (now - state.reviewed_on).days)
    return _recall_probability(state.stability, elapsed)


def schedule(attempts: Iterable[AttemptLike]) -> ReviewState | None:
    """Replay attempts in date order. None means the problem was never attempted."""
    state = None
    # sorted() is stable, so same-day attempts keep the order they were given in.
    for a in sorted(attempts, key=lambda a: a.attempted_on):
        state = update(state, rating(a.solved, a.confidence, a.used_hint), a.attempted_on)
    return state


# Lets a type checker confirm this module matches the shared scheduler signatures.
_update: UpdateFn[ReviewState] = update
_retention: RetentionFn[ReviewState] = retention
