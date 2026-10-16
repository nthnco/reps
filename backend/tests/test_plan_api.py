from datetime import timedelta

from app.clock import local_today

TEN_MIN = {"solved": True, "duration_seconds": 600, "confidence": 4}


def add_problem(client, slug: str, difficulty: str = "medium") -> int:
    body = {
        "title": slug,
        "link": f"https://leetcode.com/problems/{slug}/",
        "pattern": "arrays_hashing",
        "difficulty": difficulty,
    }
    return client.post("/api/problems", json=body).json()["id"]


def log(client, problem_id: int, days_ago: int, **overrides) -> None:
    attempted_on = (local_today() - timedelta(days=days_ago)).isoformat()
    response = client.post(
        f"/api/problems/{problem_id}/attempts",
        json=TEN_MIN | {"attempted_on": attempted_on} | overrides,
    )
    assert response.status_code == 201


def plan(client) -> dict:
    response = client.get("/api/plan/today")
    assert response.status_code == 200
    return response.json()


def rows(items: list[dict]) -> list[tuple[int, bool]]:
    return [(item["problem"]["id"], item["done"]) for item in items]


def test_working_through_the_plan_marks_items_done_without_changing_it(client):
    review = add_problem(client, "contains-duplicate", "easy")
    new = add_problem(client, "valid-anagram", "easy")
    # Due today. With a hint, so the pattern stays on easies and `new` is suggested.
    log(client, review, days_ago=1, used_hint=True)
    before = plan(client)

    log(client, review, days_ago=0)
    log(client, new, days_ago=0, solved=False)
    after = plan(client)

    assert rows(before["items"]) == [(new, False), (review, False)]
    assert rows(after["items"]) == [(new, True), (review, True)]
    assert after["suggestion"]["problem"]["id"] == new


def test_reviews_that_dont_fit_go_to_the_backlog(client):
    # 45-minute solves: the first review fits with the 15-minute new easy, the second doesn't.
    # With hints, so the pattern isn't covered and its easy is suggested.
    slow = [add_problem(client, f"slow-{i}") for i in range(2)]
    for problem_id in slow:
        log(client, problem_id, days_ago=1, duration_seconds=45 * 60, used_hint=True)
    new = add_problem(client, "two-sum", "easy")

    p = plan(client)

    assert [i["problem"]["id"] for i in p["items"]] == [new, slow[0]]
    assert [i["estimate_seconds"] for i in p["items"]] == [15 * 60, 45 * 60]
    assert rows(p["backlog"]) == [(slow[1], False)]


def test_intense_pace_plans_two_new_problems_in_a_longer_budget(client):
    first = add_problem(client, "two-sum", "easy")
    second = add_problem(client, "valid-anagram", "easy")

    steady = plan(client)
    response = client.get("/api/plan/today", params={"pace": "intense"})

    assert response.status_code == 200
    intense = response.json()
    assert (steady["budget_seconds"], rows(steady["items"])) == (60 * 60, [(first, False)])
    assert (intense["budget_seconds"], rows(intense["items"])) == (
        90 * 60,
        [(first, False), (second, False)],
    )


def test_an_unknown_pace_is_a_422(client):
    assert client.get("/api/plan/today", params={"pace": "fast"}).status_code == 422
