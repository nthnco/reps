from datetime import date, timedelta

from app.activity import run_length, window_start
from app.clock import local_today

WED = date(2026, 10, 14)


def days_before(today: date, *offsets: int) -> set[date]:
    return {today - timedelta(days=n) for n in offsets}


def test_run_counts_back_from_today():
    assert run_length(days_before(WED, 0, 1, 2, 4), WED) == 3


def test_run_isnt_broken_before_todays_practice():
    assert run_length(days_before(WED, 1, 2), WED) == 2


def test_run_is_broken_when_yesterday_was_missed_too():
    assert run_length(days_before(WED, 2, 3), WED) == 0


def test_window_starts_on_the_sunday_25_weeks_before_this_one():
    start = window_start(WED)
    assert start == date(2026, 4, 19)
    assert start.weekday() == 6  # Sunday


def test_window_on_a_sunday_ends_with_a_one_day_column():
    sunday = date(2026, 10, 11)
    assert window_start(sunday) == sunday - timedelta(weeks=25)


# API


def add_problem(client, slug: str) -> int:
    body = {
        "title": slug,
        "link": f"https://leetcode.com/problems/{slug}/",
        "pattern": "arrays_hashing",
        "difficulty": "easy",
    }
    return client.post("/api/problems", json=body).json()["id"]


def log(client, problem_id: int, days_ago: int) -> None:
    attempted_on = (local_today() - timedelta(days=days_ago)).isoformat()
    response = client.post(
        f"/api/problems/{problem_id}/attempts",
        json={"solved": True, "duration_seconds": 600, "confidence": 4, "attempted_on": attempted_on},
    )
    assert response.status_code == 201


def test_activity_counts_attempts_per_day_inside_the_window(client):
    first = add_problem(client, "two-sum")
    second = add_problem(client, "contains-duplicate")
    today = local_today()
    before_window = (today - window_start(today)).days + 1
    log(client, first, before_window)
    log(client, first, 1)
    log(client, second, 1)
    log(client, first, 0)

    response = client.get("/api/activity")

    assert response.status_code == 200
    body = response.json()
    assert body["today"] == today.isoformat()
    assert body["days"] == [
        {"day": (today - timedelta(days=1)).isoformat(), "count": 2},
        {"day": today.isoformat(), "count": 1},
    ]
    assert body["run"] == 2
