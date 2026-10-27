"""A problem's status for the problem list, from its replayed SM-2 state.

Reads SM-2's `repetitions`, so switching to FSRS means redefining "fresh".
"""

from collections.abc import Sequence
from datetime import date
from enum import StrEnum

from app.sm2 import AttemptLike, quality, schedule

# Days past the due date before a problem counts as overdue. Young problems are
# due a day after a solve, so 0 would turn most of them red within a day.
OVERDUE_AFTER_DAYS = 3
# Quality 4+ is a solve with no hint and confidence 4-5.
CONFIDENT_QUALITY = 4
# Passes in a row before a problem can be fresh: the second puts it 6 days out.
FRESH_REPETITIONS = 2


class Status(StrEnum):
    NOT_STARTED = "not_started"
    NOT_SOLVED = "not_solved"  # attempted, never solved; always in the queue
    OVERDUE = "overdue"
    LEARNING = "learning"
    FRESH = "fresh"


def problem_status(attempts: Sequence[AttemptLike], today: date) -> Status:
    state = schedule(attempts)
    if state is None:
        return Status.NOT_STARTED
    if not any(a.solved for a in attempts):
        return Status.NOT_SOLVED
    if (today - state.due_on).days >= OVERDUE_AFTER_DAYS:
        return Status.OVERDUE
    # The last attempt in replay order: by date, same-day ones as given.
    last = sorted(attempts, key=lambda a: a.attempted_on)[-1]
    if (
        state.repetitions >= FRESH_REPETITIONS
        and quality(last.solved, last.confidence, last.used_hint) >= CONFIDENT_QUALITY
    ):
        return Status.FRESH
    return Status.LEARNING
