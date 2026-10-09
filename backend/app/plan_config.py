"""Every tunable number behind today's plan, in one place. Pace (TREE.md branch 11) goes here too."""

from app.models import Difficulty

BUDGET_SECONDS = 60 * 60

# A problem's estimate is its last timed solve; until it has one, this.
DEFAULT_ESTIMATE_SECONDS = {
    Difficulty.EASY: 15 * 60,
    Difficulty.MEDIUM: 25 * 60,
    Difficulty.HARD: 35 * 60,
}
