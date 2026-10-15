from datetime import timedelta

import pytest
from sqlalchemy import event

from app.clock import local_today

PROBLEM = {
    "title": "Two Sum",
    "link": "https://leetcode.com/problems/two-sum/",
    "pattern": "arrays_hashing",
    "difficulty": "easy",
}
ATTEMPT = {"solved": True, "duration_seconds": 900, "confidence": 4}


@pytest.fixture
def problem_id(client) -> int:
    return client.post("/api/problems", json=PROBLEM).json()["id"]


def test_list_problems_sorted_by_title(client):
    client.post("/api/problems", json=PROBLEM | {"title": "Valid Parentheses",
                "link": "https://leetcode.com/problems/valid-parentheses/"})
    client.post("/api/problems", json=PROBLEM)

    response = client.get("/api/problems")

    assert response.status_code == 200
    assert [p["title"] for p in response.json()] == ["Two Sum", "Valid Parentheses"]


def test_create_attempt_defaults_to_today(client, problem_id):
    response = client.post(f"/api/problems/{problem_id}/attempts", json=ATTEMPT)

    assert response.status_code == 201
    body = response.json()
    assert body["problem_id"] == problem_id
    assert body["attempted_on"] == local_today().isoformat()
    assert body["used_hint"] is False


def test_create_attempt_with_past_date(client, problem_id):
    yesterday = (local_today() - timedelta(days=1)).isoformat()

    response = client.post(
        f"/api/problems/{problem_id}/attempts", json=ATTEMPT | {"attempted_on": yesterday}
    )

    assert response.status_code == 201
    assert response.json()["attempted_on"] == yesterday


def test_create_attempt_for_missing_problem_returns_404(client):
    response = client.post("/api/problems/999999/attempts", json=ATTEMPT)

    assert response.status_code == 404


@pytest.mark.parametrize(
    "overrides",
    [
        {"attempted_on": (local_today() + timedelta(days=1)).isoformat()},
        {"confidence": 0},
        {"confidence": 6},
        {"duration_seconds": -1},
        {"duration_seconds": 24 * 60 * 60 + 1},
        {"solved": None},
    ],
)
def test_invalid_attempt_returns_422(client, problem_id, overrides):
    response = client.post(f"/api/problems/{problem_id}/attempts", json=ATTEMPT | overrides)

    assert response.status_code == 422


def test_attempt_response_reports_skill_before_and_after(client, problem_id):
    url = f"/api/problems/{problem_id}/attempts"
    solve = client.post(url, json=ATTEMPT).json()
    fail = client.post(url, json=ATTEMPT | {"solved": False}).json()

    assert solve["skill_after"] > solve["skill_before"]
    # skill_before excludes the new attempt, so each one picks up where the last left off.
    assert fail["skill_before"] == solve["skill_after"]
    assert fail["skill_after"] <= fail["skill_before"]


def test_backdated_attempt_replays_the_due_date_in_date_order(client, problem_id):
    url = f"/api/problems/{problem_id}/attempts"
    today = local_today()
    client.post(url, json=ATTEMPT)

    response = client.post(
        url, json=ATTEMPT | {"attempted_on": (today - timedelta(days=3)).isoformat()}
    )

    # Replayed by date, today's solve is the second clean review (6 days), not the
    # first (1 day): the backdated attempt is slotted in before it.
    assert response.json()["next_review_on"] == (today + timedelta(days=6)).isoformat()


def test_attempt_queries_dont_grow_with_history(client, db, problem_id):
    url = f"/api/problems/{problem_id}/attempts"

    def queries_for_one_post() -> int:
        selects = []

        def record(_conn, _cursor, sql, *_):
            # SELECTs only: the test session's SAVEPOINT bookkeeping varies between calls.
            if sql.startswith("SELECT"):
                selects.append(sql)

        event.listen(db.get_bind(), "before_cursor_execute", record)
        client.post(url, json=ATTEMPT)
        event.remove(db.get_bind(), "before_cursor_execute", record)
        return len(selects)

    first = queries_for_one_post()
    for _ in range(4):
        client.post(url, json=ATTEMPT)
    # Reloading expired attempts one at a time would add a query per attempt.
    assert queries_for_one_post() == first
