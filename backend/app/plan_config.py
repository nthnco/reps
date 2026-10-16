"""Every tunable number behind today's plan, in one place."""

from dataclasses import dataclass
from enum import StrEnum

from app.models import Difficulty


class Pace(StrEnum):
    LIGHT = "light"
    STEADY = "steady"
    INTENSE = "intense"


@dataclass(frozen=True)
class PaceSettings:
    budget_seconds: int
    new_per_day: int


# Two new a day roughly doubles the review load within weeks; raise steady to
# 2 only if its backlog stays at zero.
PACES = {
    Pace.LIGHT: PaceSettings(budget_seconds=30 * 60, new_per_day=1),
    Pace.STEADY: PaceSettings(budget_seconds=60 * 60, new_per_day=1),
    Pace.INTENSE: PaceSettings(budget_seconds=90 * 60, new_per_day=2),
}

# A problem's estimate is its last timed solve; until it has one, this.
DEFAULT_ESTIMATE_SECONDS = {
    Difficulty.EASY: 15 * 60,
    Difficulty.MEDIUM: 25 * 60,
    Difficulty.HARD: 35 * 60,
}
