from dataclasses import dataclass
from datetime import date, timedelta

import pytest

from app.fsrs import AGAIN, EASY, GOOD, HARD, W, ReviewState, rating, retention, schedule, update

DAY0 = date(2026, 10, 1)


@dataclass
class FakeAttempt:
    attempted_on: date
    solved: bool = True
    confidence: int = 3
    used_hint: bool = False


@pytest.mark.parametrize(
    ("solved", "confidence", "used_hint", "expected"),
    [
        (False, 5, False, AGAIN),
        (False, 5, True, AGAIN),
        (True, 1, False, HARD),
        (True, 2, False, HARD),
        (True, 3, False, GOOD),
        (True, 4, False, EASY),
        (True, 5, False, EASY),
        (True, 5, True, HARD),  # a hint caps it at the weakest pass
    ],
)
def test_rating(solved, confidence, used_hint, expected):
    assert rating(solved, confidence, used_hint) == expected


# Expected numbers below were produced by py-fsrs 6.3.2 with learning steps and
# fuzzing off, which this module matches to floating-point precision.
@pytest.mark.parametrize(
    ("r", "difficulty", "interval"),
    [(AGAIN, 6.4133, 1), (HARD, 5.1122, 1), (GOOD, 2.1181, 2), (EASY, 1.0, 8)],
)
def test_first_review_uses_initial_stability_and_difficulty(r, difficulty, interval):
    state = update(None, r, DAY0)
    assert state.stability == W[r - 1]
    assert state.difficulty == pytest.approx(difficulty, abs=1e-4)
    assert state.due_on == DAY0 + timedelta(days=interval)


def test_recall_on_the_due_date_grows_stability():
    first = update(None, GOOD, DAY0)
    second = update(first, GOOD, first.due_on)
    assert second.stability == pytest.approx(10.9643, abs=1e-4)
    assert (second.due_on - second.reviewed_on).days == 11


def test_lapse_shrinks_stability_and_raises_difficulty():
    first = update(None, GOOD, DAY0)
    second = update(first, GOOD, first.due_on)
    lapsed = update(second, AGAIN, second.due_on)
    assert lapsed.stability == pytest.approx(1.5383, abs=1e-4)
    assert lapsed.difficulty == pytest.approx(7.3922, abs=1e-4)
    assert (lapsed.due_on - lapsed.reviewed_on).days == 2


def test_same_day_good_does_not_lower_stability():
    first = update(None, GOOD, DAY0)
    assert update(first, GOOD, DAY0).stability >= first.stability


def test_same_day_again_lowers_stability():
    first = update(None, GOOD, DAY0)
    assert update(first, AGAIN, DAY0).stability < first.stability


def test_difficulty_stays_in_range():
    state = None
    for _ in range(20):
        state = update(state, AGAIN, DAY0)
    # Mean reversion keeps it just under 10 rather than pinned there.
    assert 9.9 < state.difficulty <= 10.0
    for _ in range(50):
        state = update(state, EASY, state.due_on)
    assert state.difficulty >= 1.0


def test_interval_is_capped():
    state = ReviewState(stability=1e9, difficulty=1.0, reviewed_on=DAY0, due_on=DAY0)
    assert (update(state, EASY, DAY0 + timedelta(days=365)).due_on - (DAY0 + timedelta(days=365))).days == 36500


@pytest.mark.parametrize("r", [0, 5])
def test_rejects_out_of_range_rating(r):
    with pytest.raises(ValueError):
        update(None, r, DAY0)


def test_schedule_with_no_attempts_is_none():
    assert schedule([]) is None


def test_schedule_replays_attempts_in_date_order():
    later = FakeAttempt(DAY0 + timedelta(days=2), solved=False)
    earlier = FakeAttempt(DAY0)
    assert schedule([later, earlier]) == update(update(None, GOOD, DAY0), AGAIN, later.attempted_on)


def test_retention_is_full_on_the_review_day():
    assert retention(update(None, GOOD, DAY0), DAY0) == 1.0


def test_retention_is_ninety_percent_after_stability_days():
    state = ReviewState(stability=10.0, difficulty=5.0, reviewed_on=DAY0, due_on=DAY0)
    assert retention(state, DAY0 + timedelta(days=10)) == pytest.approx(0.9)


def test_retention_decays_slowly_on_a_power_curve():
    state = ReviewState(stability=10.0, difficulty=5.0, reviewed_on=DAY0, due_on=DAY0)
    r = [retention(state, DAY0 + timedelta(days=n)) for n in (10, 100, 1000)]
    assert r[0] > r[1] > r[2] > 0.3  # a power curve has a long tail; exponential would be ~0


def test_retention_before_the_review_day_is_capped_at_one():
    state = update(None, GOOD, DAY0)
    assert retention(state, DAY0 - timedelta(days=3)) == 1.0
