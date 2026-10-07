"""The signatures every scheduler module (sm2.py, later fsrs.py) must expose.

Each module owns its own state type; callers treat that state as opaque and
only hand it back to the same module's functions. Dates are calendar dates
(see TREE.md), so `now` is a date, not a datetime.
"""

from collections.abc import Callable
from datetime import date

# None is the state of a problem that has never been reviewed.
type UpdateFn[S] = Callable[[S | None, int, date], S]
# Estimated probability, in [0, 1], that the problem would be recalled on `now`.
type RetentionFn[S] = Callable[[S, date], float]
