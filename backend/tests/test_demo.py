import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import engine, get_db
from app.demo import get_workspace_db, load_demo_config
from app.main import app

TWO_SUM = {
    "title": "Two Sum",
    "link": "https://leetcode.com/problems/two-sum/",
    "pattern": "arrays_hashing",
    "difficulty": "easy",
}


@pytest.fixture
def demo(migrated_db):
    """Demo routing on. Workspaces commit for real, so drop them afterwards."""
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


def test_demo_refuses_to_run_with_the_login_gate():
    env = {"DEMO_MODE": "true", "REQUIRE_LOGIN": "true", "SECRET_KEY": "k"}
    with pytest.raises(RuntimeError, match="REQUIRE_LOGIN"):
        load_demo_config(env)


def test_demo_needs_a_secret_key_to_sign_workspace_cookies():
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        load_demo_config({"DEMO_MODE": "true"})
