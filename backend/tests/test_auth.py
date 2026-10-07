import pytest

from app.auth import AuthConfig, load_auth_config, password_hash
from app.main import app

GATED = AuthConfig(
    required=True,
    username="nathan",
    password_hash=password_hash.hash("correct horse"),
    secret_key="unused-in-tests",
)


@pytest.fixture
def gated(client):
    """The API client, with the login gate turned on."""
    original = app.state.auth
    app.state.auth = GATED
    yield client
    app.state.auth = original


def login(client, username="nathan", password="correct horse"):
    return client.post("/api/auth/login", json={"username": username, "password": password})


def test_gated_routes_reject_anonymous_requests(gated):
    assert gated.get("/api/problems").status_code == 401
    assert gated.get("/api/queue").status_code == 401
    assert gated.get("/api/patterns/mastery").status_code == 401
    assert gated.get("/api/profile/summary").status_code == 401
    assert gated.post("/api/problems", json={}).status_code == 401
    assert gated.get("/api/auth/me").status_code == 401


def test_health_stays_open_for_the_host_health_check(gated):
    assert gated.get("/api/health").status_code == 200


@pytest.mark.parametrize(
    "username, password",
    [("nathan", "wrong"), ("someone", "correct horse"), ("", "")],
)
def test_bad_credentials_are_rejected(gated, username, password):
    assert login(gated, username, password).status_code == 401
    assert gated.get("/api/queue").status_code == 401


def test_login_then_logout(gated):
    assert login(gated).status_code == 204
    assert gated.get("/api/queue").status_code == 200
    assert gated.get("/api/auth/me").json() == {"username": "nathan"}

    assert gated.post("/api/auth/logout").status_code == 204
    assert gated.get("/api/queue").status_code == 401


def test_gate_off_lets_everything_through(client):
    assert client.get("/api/queue").status_code == 200
    assert client.get("/api/auth/me").json() == {"username": None}


def test_config_is_off_unless_required():
    assert load_auth_config({}) == AuthConfig(required=False)


def test_config_refuses_to_start_with_missing_credentials():
    with pytest.raises(RuntimeError, match="APP_PASSWORD_HASH, SECRET_KEY"):
        load_auth_config({"REQUIRE_LOGIN": "true", "APP_USERNAME": "nathan"})
