from datetime import UTC, date, datetime

import pytest

from app import clock

PROBLEM = {
    "title": "Two Sum",
    "link": "https://leetcode.com/problems/two-sum/",
    "pattern": "arrays_hashing",
    "difficulty": "easy",
}
ATTEMPT = {"solved": True, "duration_seconds": 900, "confidence": 4}


def freeze(monkeypatch, utc_now: datetime) -> None:
    """Make clock.local_today() see utc_now as the current moment."""

    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return utc_now.astimezone(tz)

    monkeypatch.setattr(clock, "datetime", FrozenDatetime)


@pytest.mark.parametrize(
    ("utc_now", "expected"),
    [
        # 10pm in LA is already the next day in UTC.
        (datetime(2026, 10, 6, 5, 0, tzinfo=UTC), date(2026, 10, 5)),
        # Rollover at LA midnight (UTC-7 in October)...
        (datetime(2026, 10, 6, 6, 59, tzinfo=UTC), date(2026, 10, 5)),
        (datetime(2026, 10, 6, 7, 0, tzinfo=UTC), date(2026, 10, 6)),
        # ...and UTC-8 in January.
        (datetime(2026, 1, 15, 7, 59, tzinfo=UTC), date(2026, 1, 14)),
        (datetime(2026, 1, 15, 8, 0, tzinfo=UTC), date(2026, 1, 15)),
    ],
)
def test_today_is_the_los_angeles_date(monkeypatch, utc_now, expected):
    freeze(monkeypatch, utc_now)
    assert clock.local_today() == expected


def test_late_evening_attempt_is_dated_today_not_tomorrow(monkeypatch, client):
    freeze(monkeypatch, datetime(2026, 10, 6, 5, 0, tzinfo=UTC))  # Oct 5, 10pm in LA
    problem_id = client.post("/api/problems", json=PROBLEM).json()["id"]
    url = f"/api/problems/{problem_id}/attempts"

    assert client.post(url, json=ATTEMPT).json()["attempted_on"] == "2026-10-05"
    # Oct 6 is already "today" in UTC, but still the future in LA.
    assert client.post(url, json=ATTEMPT | {"attempted_on": "2026-10-06"}).status_code == 422
