from dataclasses import dataclass, field
from datetime import date, timedelta
from itertools import count

import pytest

from app import mastery_config as cfg
from app.mastery import (
    MasteryState,
    attempt_score,
    certainty,
    displayed_mastery,
    ewma,
    pattern_mastery,
    profile_summary,
    record,
    total_completed,
)
from app.models import Difficulty, Pattern
from app.sm2 import retention, update

DAY0 = date(2026, 10, 1)
_ids = count(1)


@dataclass
class FakeAttempt:
    attempted_on: date = DAY0
    solved: bool = True
    duration_seconds: int = 600
    used_hint: bool = False
    id: int = field(default_factory=lambda: next(_ids))


@dataclass
class FakeProblem:
    pattern: Pattern = Pattern.STACK
    difficulty: Difficulty = Difficulty.MEDIUM
    attempts: list[FakeAttempt] = field(default_factory=list)


def row_for(pattern, problems):
    return next(r for r in pattern_mastery(problems) if r.pattern == pattern)


# --- attempt score ---

MEDIUM_LIMIT = cfg.SLOW_AFTER_SECONDS[Difficulty.MEDIUM]


@pytest.mark.parametrize(
    ("solved", "used_hint", "seconds", "expected"),
    [
        (True, False, 600, 1.0),
        (True, False, 0, 1.0),  # no time recorded counts as fast
        (True, False, MEDIUM_LIMIT, 1.0),  # exactly at the limit is on time
        (True, False, MEDIUM_LIMIT + 1, 0.6),
        (True, True, 600, 0.6),
        (True, True, MEDIUM_LIMIT + 1, 0.6),  # hint and slow don't stack
        (False, False, 600, 0.0),
        (False, True, MEDIUM_LIMIT + 1, 0.0),
    ],
)
def test_attempt_score(solved, used_hint, seconds, expected):
    assert attempt_score(solved, used_hint, seconds, Difficulty.MEDIUM) == expected


@pytest.mark.parametrize(
    ("difficulty", "minutes"), [(Difficulty.EASY, 15), (Difficulty.MEDIUM, 25), (Difficulty.HARD, 35)]
)
def test_slow_limit_depends_on_difficulty(difficulty, minutes):
    assert attempt_score(True, False, minutes * 60, difficulty) == 1.0
    assert attempt_score(True, False, minutes * 60 + 1, difficulty) == 0.6


# --- EWMA and peak ---


def test_ewma_weights_the_new_score_by_alpha():
    assert ewma(old=1.0, new=0.0) == pytest.approx(0.3)
    assert ewma(old=0.0, new=1.0) == pytest.approx(0.7)
    assert ewma(old=0.6, new=1.0) == pytest.approx(0.88)


def test_first_attempt_sets_mastery_outright():
    assert record(MasteryState(), 1.0).mastery == 1.0
    assert record(MasteryState(), 0.6).mastery == 0.6


def test_record_folds_scores_in_order():
    state = MasteryState()
    for score in (1.0, 0.0, 0.6):
        state = record(state, score)
    # 1.0 -> 0.3 -> 0.7 * 0.6 + 0.3 * 0.3 = 0.51
    assert state.mastery == pytest.approx(0.51)
    assert state.attempt_count == 3


def test_peak_never_decreases():
    scores = [0.6, 1.0, 1.0, 0.0, 0.0, 0.6, 1.0, 0.0]
    state, peaks = MasteryState(), []
    for score in scores:
        state = record(state, score)
        peaks.append(state.peak)
        assert state.peak >= state.mastery

    assert peaks == sorted(peaks)
    # Mastery peaks at 0.964 after the third score, then falls to 0.25; peak stays.
    assert state.peak == pytest.approx(0.964)
    assert state.mastery == pytest.approx(0.25014252)


# --- certainty ---


@pytest.mark.parametrize(("n", "expected"), [(0, 0.0), (1, 1 / 6), (5, 0.5), (30, 30 / 35)])
def test_certainty(n, expected):
    assert certainty(n) == pytest.approx(expected)


# --- decay ---


def full_retention(state: str, now: date) -> float:
    return 1.0


def no_retention(state: str, now: date) -> float:
    return 0.0


def test_no_attempted_problems_means_no_decay():
    assert displayed_mastery(0.8, [], no_retention, DAY0) == 0.8


def test_retention_fn_is_called_with_the_opaque_states():
    seen = []

    def spy(state: str, now: date) -> float:
        seen.append((state, now))
        return 0.5

    assert displayed_mastery(0.8, ["a", "b"], spy, DAY0) == pytest.approx(0.4)
    assert seen == [("a", DAY0), ("b", DAY0)]


def test_decay_averages_retention_across_problems():
    fns = {"fresh": 1.0, "stale": 0.4}
    assert displayed_mastery(
        1.0, ["fresh", "stale"], lambda s, now: fns[s], DAY0
    ) == pytest.approx(0.7)


def test_decay_is_floored():
    assert displayed_mastery(0.8, ["x"], no_retention, DAY0) == pytest.approx(0.8 * cfg.RETENTION_FLOOR)


def test_decay_with_sm2_at_zero_days_and_a_very_large_gap():
    state = update(None, 4, DAY0)

    assert displayed_mastery(0.9, [state], retention, DAY0) == pytest.approx(0.9)
    far = DAY0 + timedelta(days=100_000)
    assert displayed_mastery(0.9, [state], retention, far) == pytest.approx(0.9 * cfg.RETENTION_FLOOR)


# --- per-pattern rows ---


def test_every_pattern_gets_a_row_in_order():
    rows = pattern_mastery([])

    assert [r.pattern for r in rows] == list(Pattern)
    assert all(r.attempt_count == 0 and r.mastery == 0.0 for r in rows)
    assert all(r.last_practiced_on is None and r.median_solve_seconds is None for r in rows)


def test_attempts_across_a_patterns_problems_are_replayed_by_date():
    # Logged out of order (the fail was backdated), but replayed by date:
    # clean on day 0, fail on day 1, clean on day 2 -> 1.0, 0.3, 0.79.
    a = FakeProblem(attempts=[FakeAttempt(DAY0), FakeAttempt(DAY0 + timedelta(2))])
    b = FakeProblem(attempts=[FakeAttempt(DAY0 + timedelta(1), solved=False)])

    row = row_for(Pattern.STACK, [a, b])

    assert row.mastery == pytest.approx(0.79)
    assert row.peak == 1.0
    assert row.attempt_count == 3
    assert row.certainty == pytest.approx(3 / 8)
    assert row.last_practiced_on == DAY0 + timedelta(2)


def test_same_day_attempts_replay_in_logged_order():
    problem = FakeProblem(attempts=[FakeAttempt(solved=False), FakeAttempt()])
    assert row_for(Pattern.STACK, [problem]).mastery == pytest.approx(0.7)


def test_difficulty_comes_from_the_problem():
    # 20 minutes is on time for a medium, slow for an easy.
    easy = FakeProblem(Pattern.HEAP, Difficulty.EASY, [FakeAttempt(duration_seconds=1200)])
    medium = FakeProblem(Pattern.TRIES, Difficulty.MEDIUM, [FakeAttempt(duration_seconds=1200)])

    assert row_for(Pattern.HEAP, [easy]).mastery == 0.6
    assert row_for(Pattern.TRIES, [medium]).mastery == 1.0


def test_median_solve_time_uses_each_problems_latest_solve():
    problems = [
        # Latest attempt failed, so its earlier 300s solve counts.
        FakeProblem(
            attempts=[
                FakeAttempt(DAY0, duration_seconds=300),
                FakeAttempt(DAY0 + timedelta(1), solved=False, duration_seconds=2000),
            ]
        ),
        # An old slow solve is replaced by the newer 600s one.
        FakeProblem(
            attempts=[
                FakeAttempt(DAY0, duration_seconds=5000),
                FakeAttempt(DAY0 + timedelta(1), duration_seconds=600),
            ]
        ),
        FakeProblem(attempts=[FakeAttempt(duration_seconds=7200)]),
        FakeProblem(attempts=[FakeAttempt(solved=False)]),  # never solved: no time
    ]

    assert row_for(Pattern.STACK, problems).median_solve_seconds == 600


def test_patterns_dont_mix():
    problems = [
        FakeProblem(Pattern.STACK, attempts=[FakeAttempt()]),
        FakeProblem(Pattern.HEAP, attempts=[FakeAttempt(solved=False)]),
    ]

    assert row_for(Pattern.STACK, problems).mastery == 1.0
    assert row_for(Pattern.HEAP, problems).mastery == 0.0


def test_total_completed_counts_problems_solved_at_least_once():
    problems = [
        FakeProblem(attempts=[FakeAttempt(solved=False), FakeAttempt()]),
        FakeProblem(attempts=[FakeAttempt(), FakeAttempt()]),
        FakeProblem(attempts=[FakeAttempt(solved=False)]),
        FakeProblem(),
    ]
    assert total_completed(problems) == 2


# --- profile summary ---


def summary_from(problems_by_pattern: dict[Pattern, int], displayed: dict[Pattern, float]):
    """n distinct problems per pattern, one clean attempt each; `displayed` overrides decay."""
    problems = [
        FakeProblem(pattern, attempts=[FakeAttempt()])
        for pattern, n in problems_by_pattern.items()
        for _ in range(n)
    ]
    shown = {p: displayed.get(p, 0.0) for p in Pattern}
    return profile_summary(pattern_mastery(problems), shown, total_completed(problems))


def test_summary_with_no_attempts():
    summary = summary_from({}, {})

    assert summary.overall == 0.0
    assert summary.strengths == summary.weaknesses == ()
    assert summary.not_started == tuple(Pattern)
    assert summary.total_completed == 0


def test_overall_averages_only_patterns_with_enough_problems():
    summary = summary_from(
        {Pattern.STACK: 2, Pattern.HEAP: 3, Pattern.TRIES: 1},
        {Pattern.STACK: 0.9, Pattern.HEAP: 0.7, Pattern.TRIES: 0.1},
    )

    # TRIES has one problem, so it doesn't count; untouched patterns don't either.
    assert summary.overall == pytest.approx(0.8)
    counted = {part.pattern for part in summary.breakdown if part.counted}
    assert counted == {Pattern.STACK, Pattern.HEAP}
    assert len(summary.breakdown) == len(Pattern)


def test_overall_is_zero_until_a_pattern_counts():
    summary = summary_from({Pattern.STACK: 1}, {Pattern.STACK: 0.9})

    assert summary.overall == 0.0
    assert not any(part.counted for part in summary.breakdown)


def test_overall_respects_custom_weights():
    problems = [
        FakeProblem(p, attempts=[FakeAttempt()])
        for p in (Pattern.STACK, Pattern.STACK, Pattern.HEAP, Pattern.HEAP)
    ]
    shown = {p: 0.0 for p in Pattern} | {Pattern.STACK: 0.8}
    weights = {p: 1.0 for p in Pattern} | {Pattern.STACK: 3.0}

    # (3 * 0.8 + 1 * 0.0) / 4
    assert profile_summary(pattern_mastery(problems), shown, 2, weights).overall == pytest.approx(0.6)


def test_strengths_need_enough_attempts_and_high_mastery():
    summary = summary_from(
        {Pattern.STACK: 5, Pattern.HEAP: 4, Pattern.TRIES: 6},
        {Pattern.STACK: 0.9, Pattern.HEAP: 1.0, Pattern.TRIES: 0.5},
    )

    # HEAP is highest but has only 4 attempts; TRIES has attempts but 0.5 mastery.
    assert summary.strengths == (Pattern.STACK,)


def test_top_three_strengths_and_weakest_three():
    p = list(Pattern)
    attempts = {pattern: 5 for pattern in p[:8]}
    displayed = dict(zip(attempts, [0.95, 0.9, 0.85, 0.8, 0.5, 0.4, 0.3, 0.1]))

    summary = summary_from(attempts, displayed)

    assert summary.strengths == (p[0], p[1], p[2])
    assert summary.weaknesses == (p[7], p[6], p[5])
    assert summary.not_started == tuple(p[8:])


def test_mastered_patterns_are_never_weaknesses():
    # Few patterns touched: 0.8 is the lowest, but it's mastered, so not weak.
    summary = summary_from(
        {Pattern.STACK: 5, Pattern.HEAP: 5, Pattern.TRIES: 1},
        {Pattern.STACK: 0.9, Pattern.HEAP: 0.8, Pattern.TRIES: cfg.MASTERED_AT},
    )

    assert summary.weaknesses == ()


def test_weaknesses_only_include_attempted_patterns():
    summary = summary_from({Pattern.STACK: 1}, {Pattern.STACK: 0.2})

    assert summary.weaknesses == (Pattern.STACK,)
