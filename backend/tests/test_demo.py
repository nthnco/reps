from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import demo as demo_module
from app.clock import local_today
from app.db import engine, get_db
from app.demo import DemoConfig, get_workspace_db, load_demo_config, setup_registry
from app.demo_history import DAYS
from app.main import app


def problem(slug: str) -> dict:
    return {
        "title": slug,
        "link": f"https://leetcode.com/problems/{slug}/",
        "pattern": "arrays_hashing",
        "difficulty": "easy",
    }


# Not in the NeetCode preload, so it's new in every workspace.
NEW = problem("demo-test-problem")
ATTEMPT = {"solved": True, "duration_seconds": 600, "confidence": 3}


def titles(client: TestClient) -> set[str]:
    return {p["title"] for p in client.get("/api/problems").json()}


@pytest.fixture(scope="session")
def demo_registry(migrated_db):
    # Once per run: setup forces a template rebuild, which takes a moment.
    setup_registry()


@pytest.fixture
def demo(demo_registry):
    """Demo mode on. Workspaces commit for real, so drop them afterwards."""
    original = app.state.demo
    app.state.demo = DemoConfig(enabled=True, secret_key="unused-in-tests")
    app.dependency_overrides[get_db] = get_workspace_db
    yield
    app.dependency_overrides.clear()
    app.state.demo = original
    with engine.begin() as conn:
        for schema in conn.scalars(text("SELECT schema_name FROM demo_meta.workspaces")).all():
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        conn.execute(text("DELETE FROM demo_meta.workspaces"))


def test_new_visitors_start_with_sample_history(demo):
    visitor = TestClient(app)

    assert len(titles(visitor)) == 150
    assert visitor.get("/api/plan/today").json()["items"]
    with engine.connect() as conn:
        first, last = conn.execute(
            text("SELECT min(attempted_on), max(attempted_on) FROM demo_template.attempts")
        ).one()
    today = local_today()
    assert today - timedelta(days=DAYS) <= first and last < today


def test_each_visitor_sees_only_their_own_changes(demo):
    alice, bob = TestClient(app), TestClient(app)

    assert alice.post("/api/problems", json=NEW).status_code == 201

    assert "demo-test-problem" in titles(alice)
    assert "demo-test-problem" not in titles(bob)
    # Same link in another workspace isn't a duplicate.
    assert bob.post("/api/problems", json=NEW).status_code == 201


def test_workspace_starts_over_after_its_lifetime(demo):
    visitor = TestClient(app)
    visitor.post("/api/problems", json=NEW)
    with engine.begin() as conn:
        conn.execute(text("UPDATE demo_meta.workspaces SET created_at = now() - interval '61 minutes'"))

    assert "demo-test-problem" not in titles(visitor)


def test_reset_starts_the_visitor_over(demo):
    visitor = TestClient(app)
    assert visitor.get("/api/auth/me").json() == {"username": None, "demo": True}
    visitor.post("/api/problems", json=NEW)

    assert visitor.post("/api/demo/reset").status_code == 204

    assert "demo-test-problem" not in titles(visitor)
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT count(*) FROM demo_meta.workspaces")) == 1


def test_reset_is_not_found_outside_demo_mode(client):
    assert client.post("/api/demo/reset").status_code == 404


def test_oldest_workspace_is_dropped_to_make_room(demo, monkeypatch):
    monkeypatch.setattr(demo_module, "MAX_WORKSPACES", 2)
    first, second, third = TestClient(app), TestClient(app), TestClient(app)
    for visitor in (first, second, third):
        assert visitor.post("/api/problems", json=NEW).status_code == 201

    assert "demo-test-problem" in titles(second)
    assert "demo-test-problem" in titles(third)
    # first's workspace was evicted; asking again gives it a fresh copy.
    assert "demo-test-problem" not in titles(first)


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
    problem_id = visitor.post("/api/problems", json=NEW).json()["id"]
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
