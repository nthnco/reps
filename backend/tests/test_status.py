from dataclasses import dataclass
from datetime import date, timedelta

from app.status import OVERDUE_AFTER_DAYS, Status, problem_status

DAY0 = date(2026, 10, 1)


@dataclass
class FakeAttempt:
    attempted_on: date
    solved: bool = True
    confidence: int = 4
    used_hint: bool = False


def day(n: int) -> date:
    return DAY0 + timedelta(n)


def test_no_attempts_is_not_started():
    assert problem_status([], DAY0) == Status.NOT_STARTED


def test_only_failures_is_not_solved_even_long_overdue():
    attempts = [FakeAttempt(day(0), solved=False), FakeAttempt(day(1), solved=False)]
    assert problem_status(attempts, day(60)) == Status.NOT_SOLVED


def test_overdue_starts_exactly_after_the_grace_days():
    # One solve: due on day 1.
    attempts = [FakeAttempt(day(0))]
    assert problem_status(attempts, day(1 + OVERDUE_AFTER_DAYS - 1)) == Status.LEARNING
    assert problem_status(attempts, day(1 + OVERDUE_AFTER_DAYS)) == Status.OVERDUE


def test_overdue_wins_over_fresh():
    attempts = [FakeAttempt(day(0)), FakeAttempt(day(1))]  # fresh, due day 7
    assert problem_status(attempts, day(2)) == Status.FRESH
    assert problem_status(attempts, day(7 + OVERDUE_AFTER_DAYS)) == Status.OVERDUE


def test_one_confident_solve_is_still_learning():
    assert problem_status([FakeAttempt(day(0), confidence=5)], day(0)) == Status.LEARNING


def test_two_passes_ending_in_a_hint_or_shaky_solve_is_learning():
    hint = [FakeAttempt(day(0)), FakeAttempt(day(1), used_hint=True)]
    shaky = [FakeAttempt(day(0)), FakeAttempt(day(1), confidence=3)]
    assert problem_status(hint, day(2)) == Status.LEARNING
    assert problem_status(shaky, day(2)) == Status.LEARNING


def test_a_lapse_after_being_fresh_drops_back_to_learning():
    attempts = [FakeAttempt(day(0)), FakeAttempt(day(1)), FakeAttempt(day(7), solved=False)]
    assert problem_status(attempts, day(7)) == Status.LEARNING


def test_last_attempt_is_by_date_not_list_order():
    # A backdated failure logged last must not count as the most recent attempt.
    attempts = [FakeAttempt(day(1)), FakeAttempt(day(2)), FakeAttempt(day(0), solved=False)]
    assert problem_status(attempts, day(3)) == Status.FRESH
