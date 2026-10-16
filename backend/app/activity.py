"""Activity grid window and practice run. Pure: dates in, numbers out."""

from collections.abc import Container
from datetime import date, timedelta

WEEKS = 26


def window_start(today: date, weeks: int = WEEKS) -> date:
    """The Sunday that starts the grid's first column; the last column is today's week."""
    days_since_sunday = (today.weekday() + 1) % 7  # weekday(): Monday is 0, Sunday is 6
    return today - timedelta(days=days_since_sunday + 7 * (weeks - 1))


def run_length(practiced: Container[date], today: date) -> int:
    """Consecutive practiced days ending today, or yesterday if today has none yet."""
    day = today if today in practiced else today - timedelta(days=1)
    run = 0
    while day in practiced:
        run += 1
        day -= timedelta(days=1)
    return run
