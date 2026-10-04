import pytest

VALID = {
    "number": 1,
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
    assert body | {"id": None} == VALID | {"id": None, "notes": ""}


def test_create_problem_strips_whitespace(client):
    response = client.post(
        "/api/problems", json=VALID | {"title": "  Two Sum  ", "link": " " + VALID["link"]}
    )

    assert response.status_code == 201
    assert response.json()["title"] == "Two Sum"
    assert response.json()["link"] == VALID["link"]


def test_duplicate_number_returns_409(client):
    assert client.post("/api/problems", json=VALID).status_code == 201

    response = client.post("/api/problems", json=VALID | {"title": "Different title"})

    assert response.status_code == 409
    assert response.json() == {"detail": "Problem #1 is already in your list."}


@pytest.mark.parametrize(
    "overrides",
    [
        {"number": 0},
        {"title": "   "},
        {"title": "x" * 201},
        {"link": "https://example.com/problems/two-sum/"},
        {"link": "http://leetcode.com/problems/two-sum/"},
        {"link": "https://leetcode.com/contest/"},
        {"link": "https://leetcode.com/problems/" + "x" * 471},  # 501 chars
        {"pattern": "union_find"},
        {"difficulty": "impossible"},
    ],
)
def test_invalid_problem_returns_422(client, overrides):
    response = client.post("/api/problems", json=VALID | overrides)

    assert response.status_code == 422
