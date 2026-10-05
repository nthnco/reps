from datetime import date, datetime
from zoneinfo import ZoneInfo

# "Today" is computed in one fixed timezone, with a midnight rollover (see TREE.md).
TIMEZONE = ZoneInfo("America/Los_Angeles")


def local_today() -> date:
    return datetime.now(TIMEZONE).date()
