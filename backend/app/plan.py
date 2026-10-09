"""Today's plan: a time-boxed list of reviews plus the new problem, as pure functions.

The new problem always gets its slot first; reviews fill what's left, most
overdue first. The first review that doesn't fit ends the plan, so the order
stays honest: a short review never jumps a more overdue long one. Everything
after it is backlog.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Protocol

from app import plan_config as cfg
from app.models import Difficulty


class AttemptLike(Protocol):
    id: int
    attempted_on: date
    solved: bool
    duration_seconds: int


class ProblemLike(Protocol):
    difficulty: Difficulty

    @property
    def attempts(self) -> Sequence[AttemptLike]: ...


@dataclass(frozen=True)
class Entry[P]:
    problem: P
    due_on: date | None  # None: the new problem
    estimate_seconds: int


@dataclass(frozen=True)
class Plan[P]:
    items: list[Entry[P]]
    backlog: list[Entry[P]]


def estimate_seconds(problem: ProblemLike) -> int:
    """The last solve's duration, hint or not; the difficulty default if none was timed."""
    # A failed attempt's time is how long it took to give up, not to solve.
    # Duration 0 is a manual entry with no time, not a zero-minute solve.
    solves = [a for a in problem.attempts if a.solved and a.duration_seconds > 0]
    if not solves:
        return cfg.DEFAULT_ESTIMATE_SECONDS[problem.difficulty]
    return max(solves, key=lambda a: (a.attempted_on, a.id)).duration_seconds


def fit[P: ProblemLike](
    reviews: Sequence[tuple[P, date]], new: P | None, budget_seconds: int
) -> Plan[P]:
    """`reviews` most overdue first. The plan is never empty while there's anything to do."""
    items: list[Entry[P]] = []
    if new is not None:
        items.append(Entry(new, None, estimate_seconds(new)))
    used = sum(e.estimate_seconds for e in items)

    entries = [Entry(p, due_on, estimate_seconds(p)) for p, due_on in reviews]
    for i, entry in enumerate(entries):
        # An empty plan takes its first review even if it's over budget on its own.
        if items and used + entry.estimate_seconds > budget_seconds:
            return Plan(items, entries[i:])
        items.append(entry)
        used += entry.estimate_seconds
    return Plan(items, [])
