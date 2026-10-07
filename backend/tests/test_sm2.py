from dataclasses import dataclass
from datetime import date, timedelta

import pytest

from app.sm2 import INITIAL_EASE, MIN_DECAY_DAYS, MIN_EASE, ReviewState, quality, retention, schedule, update

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
    s1 = update(None, 4, DAY0)
    assert (s1.repetitions, s1.interval_days, s1.due_on) == (1, 1, DAY0 + timedelta(1))

    s2 = update(s1, 4, s1.due_on)
    assert (s2.repetitions, s2.interval_days) == (2, 6)

    s3 = update(s2, 4, s2.due_on)
    assert s3.interval_days == 15  # ceil(6 * 2.5)


@pytest.mark.parametrize(("q", "delta"), [(5, 10), (4, 0), (3, -14), (2, -32), (1, -54), (0, -80)])
def test_ease_changes_by_quality(q, delta):
    assert update(None, q, DAY0).ease == INITIAL_EASE + delta


def test_ease_never_drops_below_minimum():
    state = None
    for _ in range(5):
        state = update(state, 0, DAY0)
    assert state.ease == MIN_EASE


def test_lapse_resets_streak_but_keeps_lowered_ease():
    state = ReviewState(repetitions=4, interval_days=40, ease=250, due_on=DAY0)
    lapsed = update(state, 1, DAY0)
    assert (lapsed.repetitions, lapsed.interval_days, lapsed.ease) == (0, 1, 196)


def test_interval_math_is_exact():
    # Float math gives ceil(25 * 2.2) == 56.
    state = ReviewState(repetitions=3, interval_days=25, ease=220, due_on=DAY0)
    assert update(state, 4, DAY0).interval_days == 55


def test_due_date_counts_from_the_review_day_even_if_early():
    state = ReviewState(repetitions=2, interval_days=6, ease=250, due_on=DAY0 + timedelta(6))
    assert update(state, 4, DAY0).due_on == DAY0 + timedelta(15)


@pytest.mark.parametrize("q", [-1, 6])
def test_rejects_out_of_range_quality(q):
    with pytest.raises(ValueError):
        update(None, q, DAY0)


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


# Last reviewed on DAY0 with a 10-day interval, so due on DAY0 + 10.
TEN_DAY = ReviewState(repetitions=3, interval_days=10, ease=250, due_on=DAY0 + timedelta(10))


def test_retention_is_full_on_the_review_day():
    assert retention(TEN_DAY, DAY0) == 1.0


def test_retention_is_ninety_percent_on_the_due_date():
    assert retention(TEN_DAY, DAY0 + timedelta(10)) == pytest.approx(0.9)


def test_retention_decays_exponentially():
    # Two intervals after review is 0.9 squared, not linear.
    assert retention(TEN_DAY, DAY0 + timedelta(20)) == pytest.approx(0.81)


def test_retention_after_a_very_large_gap_approaches_zero_without_error():
    value = retention(TEN_DAY, DAY0 + timedelta(100_000))
    assert 0.0 <= value < 1e-6


def test_retention_before_the_review_day_is_capped_at_one():
    assert retention(TEN_DAY, DAY0 - timedelta(5)) == 1.0


def test_short_intervals_decay_on_the_minimum_time_scale():
    # Solved once: a 1-day interval, but decay uses 7 days, so a week later is 0.9, not 0.9**7.
    once = update(None, 4, DAY0)
    assert once.interval_days == 1
    assert retention(once, DAY0 + timedelta(MIN_DECAY_DAYS)) == pytest.approx(0.9)
