from datetime import timedelta

import pytest

from app import mastery_config as cfg
from app.clock import local_today
from app.models import Pattern
from app.sm2 import MIN_DECAY_DAYS, RETENTION_AT_DUE

CLEAN = {"solved": True, "duration_seconds": 600, "confidence": 4}


# Hard by default, so a clean solve scores exactly 1.0.
def add_problem(client, slug: str, pattern: str = "stack", difficulty: str = "hard") -> int:
    body = {
        "title": slug,
        "link": f"https://leetcode.com/problems/{slug}/",
        "pattern": pattern,
        "difficulty": difficulty,
    }
    return client.post("/api/problems", json=body).json()["id"]


def log(client, problem_id: int, days_ago: int = 0, **overrides) -> None:
    attempted_on = (local_today() - timedelta(days=days_ago)).isoformat()
    response = client.post(
        f"/api/problems/{problem_id}/attempts",
        json=CLEAN | {"attempted_on": attempted_on} | overrides,
    )
    assert response.status_code == 201


def mastery_row(client, pattern: str) -> dict:
    response = client.get("/api/patterns/mastery")
    assert response.status_code == 200
    return next(row for row in response.json() if row["pattern"] == pattern)


def summary(client) -> dict:
    response = client.get("/api/profile/summary")
    assert response.status_code == 200
    return response.json()


def test_empty_mastery_has_a_row_per_pattern(client):
    rows = client.get("/api/patterns/mastery").json()

    assert [row["pattern"] for row in rows] == [p.value for p in Pattern]
    assert rows[0] == {
        "pattern": "arrays_hashing",
        "displayed_mastery": 0.0,
        "mastery": 0.0,
        "peak": 0.0,
        "certainty": 0.0,
        "low_data": True,
        "attempt_count": 0,
        "problem_count": 0,
        "problems_attempted": 0,
        "problems_until_counted": 2,
        "attempts_until_trusted": 5,
        "due_count": 0,
        "last_practiced_on": None,
        "median_solve_seconds": None,
    }


def test_problem_without_attempts_counts_as_a_problem_only(client):
    add_problem(client, "valid-parentheses")

    row = mastery_row(client, "stack")

    assert (row["problem_count"], row["attempt_count"], row["due_count"]) == (1, 0, 0)


def test_clean_attempt_today_has_no_decay(client):
    log(client, add_problem(client, "valid-parentheses"))

    row = mastery_row(client, "stack")

    assert row["mastery"] == row["displayed_mastery"] == row["peak"] == 1.0
    assert row["attempt_count"] == 1
    assert row["certainty"] == pytest.approx(1 / 6)
    assert row["low_data"] is True
    assert row["last_practiced_on"] == local_today().isoformat()
    assert row["median_solve_seconds"] == 600


def test_yesterdays_attempt_is_due_and_slightly_decayed(client):
    log(client, add_problem(client, "valid-parentheses"), days_ago=1)

    row = mastery_row(client, "stack")

    assert row["due_count"] == 1
    assert row["mastery"] == 1.0
    assert row["displayed_mastery"] == pytest.approx(RETENTION_AT_DUE ** (1 / MIN_DECAY_DAYS))


def test_long_untouched_pattern_decays_to_the_floor_but_keeps_its_peak(client):
    log(client, add_problem(client, "valid-parentheses"), days_ago=3000)

    row = mastery_row(client, "stack")

    assert row["displayed_mastery"] == pytest.approx(cfg.RETENTION_FLOOR)
    assert row["mastery"] == row["peak"] == 1.0


def test_five_attempts_clear_low_data(client):
    problem_id = add_problem(client, "valid-parentheses")
    for days_ago in range(5):
        log(client, problem_id, days_ago=days_ago)

    row = mastery_row(client, "stack")

    assert row["certainty"] == 0.5
    assert row["low_data"] is False


def test_empty_summary(client):
    assert summary(client) == {
        "rules": {"overall_min_problems": 2, "mastered_at": 0.6, "strength_min_attempts": 5},
        "overall": 0.0,
        "breakdown": [
            {"pattern": p.value, "weight": 1.0, "displayed_mastery": 0.0, "counted": False}
            for p in Pattern
        ],
        "strengths": [],
        "weaknesses": [],
        "needs_review": [],
        "not_started": [p.value for p in Pattern],
        "total_completed": 0,
    }


def test_summary_strengths_weaknesses_and_completed(client):
    # Stack: two problems, five clean attempts today -> mastered, enough data, counted.
    stack = add_problem(client, "valid-parentheses", pattern="stack")
    for _ in range(4):
        log(client, stack)
    log(client, add_problem(client, "min-stack", pattern="stack"))
    # Heap: one failed problem -> a weakness, but too few problems to count.
    log(client, add_problem(client, "kth-largest", pattern="heap"), solved=False)

    result = summary(client)

    assert result["strengths"] == ["stack"]
    assert result["weaknesses"] == ["heap"]
    assert "stack" not in result["not_started"] and "heap" not in result["not_started"]
    assert result["total_completed"] == 2
    assert result["overall"] == 1.0  # only stack counts
    counted = [part["pattern"] for part in result["breakdown"] if part["counted"]]
    assert counted == ["stack"]


def test_progress_counts_down_and_stops_at_zero(client):
    first = add_problem(client, "valid-parentheses")
    log(client, first)
    log(client, first)

    row = mastery_row(client, "stack")
    assert (row["problems_until_counted"], row["attempts_until_trusted"]) == (1, 3)

    log(client, add_problem(client, "min-stack"))
    for _ in range(4):
        log(client, first)

    row = mastery_row(client, "stack")
    assert (row["problems_until_counted"], row["attempts_until_trusted"]) == (0, 0)


def test_long_untouched_mastered_pattern_needs_review(client):
    first = add_problem(client, "valid-parentheses")
    log(client, first, days_ago=400)
    log(client, add_problem(client, "min-stack"), days_ago=400)

    result = summary(client)

    assert result["needs_review"] == ["stack"]
    assert result["weaknesses"] == []
