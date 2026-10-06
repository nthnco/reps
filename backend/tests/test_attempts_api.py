from datetime import timedelta

import pytest

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
