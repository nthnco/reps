import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import engine, get_db
from app import demo as demo_module
from app.demo import get_workspace_db, load_demo_config, setup_registry
from app.main import app

TWO_SUM = {
    "title": "Two Sum",
    "link": "https://leetcode.com/problems/two-sum/",
    "pattern": "arrays_hashing",
    "difficulty": "easy",
}


def problem(slug: str) -> dict:
    return TWO_SUM | {"title": slug, "link": f"https://leetcode.com/problems/{slug}/"}


ATTEMPT = {"solved": True, "duration_seconds": 600, "confidence": 3}


@pytest.fixture
def demo(migrated_db):
    """Demo routing on. Workspaces commit for real, so drop them afterwards."""
    setup_registry()
    app.dependency_overrides[get_db] = get_workspace_db
    yield
    app.dependency_overrides.clear()
    with engine.begin() as conn:
        names = conn.scalars(text(r"SELECT nspname FROM pg_namespace WHERE nspname LIKE 'demo\_%'"))
        for name in list(names):
            conn.execute(text(f'DROP SCHEMA "{name}" CASCADE'))


def test_each_visitor_sees_only_their_own_changes(demo):
    alice, bob = TestClient(app), TestClient(app)

    assert alice.post("/api/problems", json=TWO_SUM).status_code == 201

    assert [p["title"] for p in alice.get("/api/problems").json()] == ["Two Sum"]
    assert bob.get("/api/problems").json() == []
    # Same link in another workspace isn't a duplicate.
    assert bob.post("/api/problems", json=TWO_SUM).status_code == 201


def test_workspace_starts_over_after_its_lifetime(demo):
    visitor = TestClient(app)
    visitor.post("/api/problems", json=TWO_SUM)
    with engine.begin() as conn:
        conn.execute(text("UPDATE demo_meta.workspaces SET created_at = now() - interval '61 minutes'"))

    assert visitor.get("/api/problems").json() == []


def test_oldest_workspace_is_dropped_to_make_room(demo, monkeypatch):
    monkeypatch.setattr(demo_module, "MAX_WORKSPACES", 2)
    first, second, third = TestClient(app), TestClient(app), TestClient(app)
    for visitor in (first, second, third):
        assert visitor.post("/api/problems", json=TWO_SUM).status_code == 201

    assert len(second.get("/api/problems").json()) == 1
    assert len(third.get("/api/problems").json()) == 1
    # first's workspace was evicted; asking again gives it a fresh, empty one.
    assert first.get("/api/problems").json() == []


def test_new_problems_are_capped(demo, monkeypatch):
    monkeypatch.setattr(demo_module, "MAX_NEW_PROBLEMS", 2)
    visitor = TestClient(app)
    assert visitor.post("/api/problems", json=problem("a")).status_code == 201
    assert visitor.post("/api/problems", json=problem("b")).status_code == 201

    response = visitor.post("/api/problems", json=problem("c"))

    assert response.status_code == 403
    assert "up to 2 new problems" in response.json()["detail"]


def test_new_attempts_are_capped(demo, monkeypatch):
    monkeypatch.setattr(demo_module, "MAX_NEW_ATTEMPTS", 2)
    visitor = TestClient(app)
    problem_id = visitor.post("/api/problems", json=TWO_SUM).json()["id"]
    url = f"/api/problems/{problem_id}/attempts"
    assert visitor.post(url, json=ATTEMPT).status_code == 201
    assert visitor.post(url, json=ATTEMPT).status_code == 201

    assert visitor.post(url, json=ATTEMPT).status_code == 403
    assert visitor.get("/api/plan/today").status_code == 200  # reads still work


def test_demo_refuses_to_run_with_the_login_gate():
    env = {"DEMO_MODE": "true", "REQUIRE_LOGIN": "true", "SECRET_KEY": "k"}
    with pytest.raises(RuntimeError, match="REQUIRE_LOGIN"):
        load_demo_config(env)


def test_demo_needs_a_secret_key_to_sign_workspace_cookies():
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        load_demo_config({"DEMO_MODE": "true"})
