from datetime import timedelta

from app.clock import local_today

ATTEMPT = {"solved": True, "duration_seconds": 900, "confidence": 4}


def add_problem(client, title: str) -> int:
    body = {
        "title": title,
        "link": f"https://leetcode.com/problems/{title.lower()}/",
        "pattern": "arrays_hashing",
        "difficulty": "easy",
    }
    return client.post("/api/problems", json=body).json()["id"]


def log(client, problem_id: int, days_ago: int, **overrides) -> None:
    attempted_on = (local_today() - timedelta(days=days_ago)).isoformat()
    response = client.post(
        f"/api/problems/{problem_id}/attempts",
        json=ATTEMPT | {"attempted_on": attempted_on} | overrides,
    )
    assert response.status_code == 201


def queue(client) -> list[tuple[str, str | None]]:
    response = client.get("/api/queue")
    assert response.status_code == 200
    return [(item["problem"]["title"], item["due_on"]) for item in response.json()]


def test_empty_queue(client):
    assert queue(client) == []


def test_never_attempted_problem_is_new(client):
    add_problem(client, "A")

    assert queue(client) == [("A", None)]


def test_problem_due_today_is_included(client):
    # A first pass is due one day later, so yesterday's attempt is due today.
    log(client, add_problem(client, "A"), days_ago=1)

    assert queue(client) == [("A", local_today().isoformat())]


def test_problem_attempted_today_is_not_due_yet(client):
    log(client, add_problem(client, "A"), days_ago=0)

    assert queue(client) == []


def test_replays_full_history_not_just_last_attempt(client):
    # Second pass in a row gets a 6-day interval: 6 days ago + 6 = today.
    # Treating the last attempt as a first review would give 5 days ago.
    problem_id = add_problem(client, "A")
    log(client, problem_id, days_ago=7)
    log(client, problem_id, days_ago=6)

    assert queue(client) == [("A", local_today().isoformat())]


def test_most_overdue_first_then_new(client):
    add_problem(client, "New")
    log(client, add_problem(client, "Today"), days_ago=1)  # due today
    log(client, add_problem(client, "Overdue"), days_ago=10)  # due 9 days ago

    titles = [title for title, _ in queue(client)]

    assert titles == ["Overdue", "Today", "New"]


def test_ties_break_by_title(client):
    add_problem(client, "Zebra")
    add_problem(client, "Apple")

    assert queue(client) == [("Apple", None), ("Zebra", None)]
