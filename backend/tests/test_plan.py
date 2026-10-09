from dataclasses import dataclass, field
from datetime import date, timedelta
from itertools import count

from app.models import Difficulty
from app.plan import estimate_seconds, fit

DAY0 = date(2026, 10, 1)
MIN = 60
_ids = count(1)


@dataclass
class FakeAttempt:
    duration_seconds: int
    solved: bool = True
    attempted_on: date = DAY0
    id: int = field(default_factory=lambda: next(_ids))


@dataclass
class FakeProblem:
    difficulty: Difficulty = Difficulty.MEDIUM
    attempts: list[FakeAttempt] = field(default_factory=list)


def timed(minutes: int) -> FakeProblem:
    """A problem whose estimate is `minutes`."""
    return FakeProblem(attempts=[FakeAttempt(minutes * MIN)])


def due(*problems: FakeProblem) -> list[tuple[FakeProblem, date]]:
    return [(p, DAY0) for p in problems]


# --- estimate ---


def test_estimate_is_the_latest_solve_not_the_slowest():
    problem = FakeProblem(
        attempts=[
            FakeAttempt(10 * MIN, attempted_on=DAY0 + timedelta(days=3)),
            FakeAttempt(40 * MIN, attempted_on=DAY0),
        ]
    )

    assert estimate_seconds(problem) == 10 * MIN


def test_estimate_skips_failures_and_untimed_solves():
    problem = FakeProblem(
        Difficulty.HARD, [FakeAttempt(50 * MIN, solved=False), FakeAttempt(0)]
    )

    assert estimate_seconds(problem) == 35 * MIN  # the hard default


# --- fit ---


def test_new_problem_goes_in_even_when_reviews_would_fill_the_day():
    new = timed(25)
    first, second = timed(30), timed(30)

    plan = fit(due(first, second), new, budget_seconds=60 * MIN)

    assert [e.problem for e in plan.items] == [new, first]
    assert plan.items[0].due_on is None
    assert [e.problem for e in plan.backlog] == [second]


def test_a_short_review_never_jumps_a_more_overdue_long_one():
    long, short = timed(50), timed(5)

    plan = fit(due(timed(20), long, short), None, budget_seconds=60 * MIN)

    assert [e.problem for e in plan.backlog] == [long, short]


def test_filling_the_budget_exactly_fits():
    plan = fit(due(timed(30), timed(30)), None, budget_seconds=60 * MIN)

    assert len(plan.items) == 2 and plan.backlog == []


def test_an_empty_plan_takes_one_review_over_budget():
    huge = timed(90)

    plan = fit(due(huge, timed(10)), None, budget_seconds=60 * MIN)

    assert [e.problem for e in plan.items] == [huge]
    assert len(plan.backlog) == 1
