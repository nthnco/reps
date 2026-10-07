"""Single-user password gate.

The one account lives in env vars (APP_USERNAME, APP_PASSWORD_HASH), not the
database. A successful login stores the username in a signed session cookie
(Starlette's SessionMiddleware, keyed by SECRET_KEY).

REQUIRE_LOGIN turns the gate on. The Docker image sets it, so a deploy that's
missing any of the other vars refuses to start instead of running open.
Local dev leaves it unset.
"""

import hmac
import os
from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pwdlib import PasswordHash
from pydantic import BaseModel

password_hash = PasswordHash.recommended()  # argon2


@dataclass(frozen=True)
class AuthConfig:
    required: bool
    username: str = ""
    password_hash: str = ""
    secret_key: str = ""


def load_auth_config(env=os.environ) -> AuthConfig:
    if env.get("REQUIRE_LOGIN", "").lower() not in ("1", "true"):
        return AuthConfig(required=False)
    names = ("APP_USERNAME", "APP_PASSWORD_HASH", "SECRET_KEY")
    missing = [name for name in names if not env.get(name)]
    if missing:
        raise RuntimeError(f"REQUIRE_LOGIN is set but {', '.join(missing)} is missing")
    return AuthConfig(
        required=True,
        username=env["APP_USERNAME"],
        password_hash=env["APP_PASSWORD_HASH"],
        secret_key=env["SECRET_KEY"],
    )


def credentials_match(config: AuthConfig, username: str, password: str) -> bool:
    # Check both before combining, so a wrong username takes as long as a
    # wrong password and response timing doesn't reveal which one was wrong.
    username_ok = hmac.compare_digest(username.encode(), config.username.encode())
    password_ok = password_hash.verify(password, config.password_hash)
    return username_ok and password_ok


def require_login(request: Request) -> None:
    """Dependency for every gated route: 401 unless logged in (or the gate is off)."""
    config: AuthConfig = request.app.state.auth
    if config.required and request.session.get("username") != config.username:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in")


router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginBody(BaseModel):
    username: str
    password: str


class Me(BaseModel):
    username: str | None


@router.post("/login", status_code=status.HTTP_204_NO_CONTENT)
def login(body: LoginBody, request: Request) -> None:
    config: AuthConfig = request.app.state.auth
    if not config.required:
        return
    if not credentials_match(config, body.username, body.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong username or password")
    request.session["username"] = config.username


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request) -> None:
    request.session.clear()


@router.get("/me", response_model=Me, dependencies=[Depends(require_login)])
def me(request: Request) -> Me:
    """Lets the frontend decide whether to show the login page.

    200 means "in": username is null when the gate is off (local dev).
    """
    return Me(username=request.session.get("username"))
