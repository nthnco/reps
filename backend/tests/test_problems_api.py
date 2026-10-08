import pytest

VALID = {
    "title": "Two Sum",
    "link": "https://leetcode.com/problems/two-sum/",
    "pattern": "arrays_hashing",
    "difficulty": "easy",
}


def test_create_problem(client):
    response = client.post("/api/problems", json=VALID)

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["id"], int)
    assert body | {"id": None} == VALID | {"id": None, "notes": "", "is_premium": False}


def test_create_problem_strips_whitespace(client):
    response = client.post(
        "/api/problems", json=VALID | {"title": "  Two Sum  ", "link": " " + VALID["link"]}
    )

    assert response.status_code == 201
    assert response.json()["title"] == "Two Sum"
    assert response.json()["link"] == VALID["link"]


@pytest.mark.parametrize(
    "link",
    [
        "https://leetcode.com/problems/two-sum",
        "https://www.leetcode.com/problems/two-sum/",
        "https://leetcode.com/problems/two-sum/description/",
        "https://leetcode.com/problems/Two-Sum/?envType=study-plan-v2#anchor",
    ],
)
def test_create_problem_normalizes_link(client, link):
    response = client.post("/api/problems", json=VALID | {"link": link})

    assert response.status_code == 201
    assert response.json()["link"] == "https://leetcode.com/problems/two-sum/"


def test_duplicate_link_returns_409_even_with_different_title_and_url_shape(client):
    assert client.post("/api/problems", json=VALID).status_code == 201

    response = client.post(
        "/api/problems",
        json=VALID | {"title": "Two Summ", "link": VALID["link"] + "description/"},
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "That problem is already in your list."}


@pytest.mark.parametrize(
    "overrides",
    [
        {"title": "   "},
        {"title": "x" * 201},
        {"link": "https://example.com/problems/two-sum/"},
        {"link": "http://leetcode.com/problems/two-sum/"},
        {"link": "https://leetcode.com/contest/"},
        {"link": "https://leetcode.com/problems/"},
        {"link": "https://leetcode.com/problems/two_sum!/"},
        {"link": "https://leetcode.com/problems/" + "x" * 471},  # 501 chars
        {"pattern": "union_find"},
        {"difficulty": "impossible"},
    ],
)
def test_invalid_problem_returns_422(client, overrides):
    response = client.post("/api/problems", json=VALID | overrides)

    assert response.status_code == 422
