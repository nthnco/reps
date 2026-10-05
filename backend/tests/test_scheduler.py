from dataclasses import dataclass
from datetime import date, timedelta

import pytest

from app.scheduler import INITIAL_EASE, MIN_EASE, ReviewState, quality, review, schedule

DAY0 = date(2026, 10, 1)


@dataclass
class FakeAttempt:
    attempted_on: date
    solved: bool = True
    confidence: int = 4
    used_hint: bool = False


@pytest.mark.parametrize(
    ("solved", "confidence", "used_hint", "expected"),
    [
        (True, 5, False, 5),
        (True, 3, False, 3),
        (True, 2, False, 2),  # solved but shaky still counts as a lapse
        (True, 5, True, 3),  # a hint caps it at a bare pass
        (True, 1, True, 1),
        (False, 5, False, 1),
        (False, 5, True, 1),
    ],
)
def test_quality(solved, confidence, used_hint, expected):
    assert quality(solved, confidence, used_hint) == expected


def test_first_reviews_use_fixed_intervals_then_multiply_by_ease():
    s1 = review(None, 4, DAY0)
    assert (s1.repetitions, s1.interval_days, s1.due_on) == (1, 1, DAY0 + timedelta(1))

    s2 = review(s1, 4, s1.due_on)
    assert (s2.repetitions, s2.interval_days) == (2, 6)

    s3 = review(s2, 4, s2.due_on)
    assert s3.interval_days == 15  # ceil(6 * 2.5)


@pytest.mark.parametrize(("q", "delta"), [(5, 10), (4, 0), (3, -14), (2, -32), (1, -54), (0, -80)])
def test_ease_changes_by_quality(q, delta):
    assert review(None, q, DAY0).ease == INITIAL_EASE + delta


def test_ease_never_drops_below_minimum():
    state = None
    for _ in range(5):
        state = review(state, 0, DAY0)
    assert state.ease == MIN_EASE


def test_lapse_resets_streak_but_keeps_lowered_ease():
    state = ReviewState(repetitions=4, interval_days=40, ease=250, due_on=DAY0)
    lapsed = review(state, 1, DAY0)
    assert (lapsed.repetitions, lapsed.interval_days, lapsed.ease) == (0, 1, 196)


def test_interval_math_is_exact():
    # Float math gives ceil(25 * 2.2) == 56.
    state = ReviewState(repetitions=3, interval_days=25, ease=220, due_on=DAY0)
    assert review(state, 4, DAY0).interval_days == 55


def test_due_date_counts_from_the_review_day_even_if_early():
    state = ReviewState(repetitions=2, interval_days=6, ease=250, due_on=DAY0 + timedelta(6))
    assert review(state, 4, DAY0).due_on == DAY0 + timedelta(15)


@pytest.mark.parametrize("q", [-1, 6])
def test_rejects_out_of_range_quality(q):
    with pytest.raises(ValueError):
        review(None, q, DAY0)


def test_schedule_with_no_attempts_is_none():
    assert schedule([]) is None


def test_schedule_replays_attempts_in_date_order():
    attempts = [
        FakeAttempt(DAY0 + timedelta(7)),
        FakeAttempt(DAY0),
        FakeAttempt(DAY0 + timedelta(1)),
    ]
    state = schedule(attempts)
    assert (state.repetitions, state.interval_days) == (3, 15)
    assert state.due_on == DAY0 + timedelta(7 + 15)


def test_schedule_keeps_given_order_for_same_day_attempts():
    fail = FakeAttempt(DAY0, solved=False)
    win = FakeAttempt(DAY0, confidence=5)
    assert schedule([fail, win]).repetitions == 1
    assert schedule([win, fail]).repetitions == 0
