from datetime import timedelta

from app.clock import local_today
from app.routes.mastery import build_suggestion

CLEAN = {"solved": True, "duration_seconds": 600, "confidence": 4}


def add_problem(client, slug: str, difficulty: str, pattern: str = "arrays_hashing") -> int:
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


def get_suggestion(client):
    response = client.get("/api/patterns/suggestion")
    assert response.status_code == 200
    return response.json()


def covered(client, pattern: str) -> bool:
    rows = client.get("/api/patterns/mastery").json()
    return next(row for row in rows if row["pattern"] == pattern)["covered"]


def test_suggests_a_full_problem_with_its_reason(client):
    easy = add_problem(client, "two-sum", "easy")
    add_problem(client, "group-anagrams", "medium")

    s = get_suggestion(client)

    assert s["pattern"] == "arrays_hashing"
    assert s["reason"] == "start_easy"
    assert s["problem"]["id"] == easy
    assert s["problem"]["link"] == "https://leetcode.com/problems/two-sum/"


def test_covered_shows_on_the_mastery_row(client):
    first = add_problem(client, "group-anagrams", "medium")
    second = add_problem(client, "top-k-frequent-elements", "medium")
    log(client, first, used_hint=True)
    assert not covered(client, "arrays_hashing")

    log(client, second)
    assert covered(client, "arrays_hashing")
    assert not covered(client, "two_pointers")


def test_keep_reviewing_has_no_problem(client):
    log(client, add_problem(client, "two-sum", "easy"))

    s = get_suggestion(client)

    assert (s["pattern"], s["reason"], s["problem"]) == ("arrays_hashing", "keep_reviewing", None)


def test_as_of_ignores_attempts_from_that_day_on(client, db):
    easy = add_problem(client, "two-sum", "easy")
    medium = add_problem(client, "group-anagrams", "medium")
    log(client, easy, days_ago=3)
    as_of = local_today() - timedelta(days=5)

    then = build_suggestion(db, as_of)
    now = build_suggestion(db)

    assert then is not None and then.problem is not None and then.problem.id == easy
    assert now is not None and now.problem is not None and now.problem.id == medium
