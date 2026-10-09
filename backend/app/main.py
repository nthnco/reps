import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException
from starlette.middleware.sessions import SessionMiddleware
from starlette.types import Scope

from app import auth, demo
from app.db import get_db
from app.routes import mastery, plan, problems

THIRTY_DAYS = 30 * 24 * 60 * 60


class SinglePageApp(StaticFiles):
    """Static files, but unknown page URLs get index.html.

    React Router handles URLs like /problems/7 in the browser; the server has
    no such file. Without this, refreshing or opening a shared link 404s.
    Unknown /api/ paths and missing files (anything with an extension) stay 404.
    """

    async def get_response(self, path: str, scope: Scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            last_segment = path.rsplit("/", 1)[-1]
            if exc.status_code != 404 or path.startswith("api/") or "." in last_segment:
                raise
            return await super().get_response("index.html", scope)

@asynccontextmanager
async def lifespan(app: FastAPI):
    if app.state.demo.enabled:
        demo.setup_registry()
    yield


app = FastAPI(title="Reps API", lifespan=lifespan)
app.state.auth = auth.load_auth_config()
app.state.demo = demo.load_demo_config()
app.add_middleware(
    SessionMiddleware,
    # With the gate and demo off nothing meaningful is stored, so any key will do.
    secret_key=app.state.auth.secret_key or app.state.demo.secret_key or "dev-only-not-secret",
    max_age=THIRTY_DAYS,
    same_site="lax",
    https_only=app.state.auth.required,
)

if app.state.demo.enabled:
    app.dependency_overrides[get_db] = demo.get_workspace_db


@app.exception_handler(demo.DemoLimitReached)
def demo_limit_reached(request: Request, exc: demo.DemoLimitReached) -> JSONResponse:
    return JSONResponse({"detail": str(exc)}, status_code=403)

app.include_router(auth.router)
app.include_router(demo.router)
login_required = [Depends(auth.require_login)]
app.include_router(problems.router, dependencies=login_required)
app.include_router(mastery.router, dependencies=login_required)
app.include_router(plan.router, dependencies=login_required)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# In production the built React app is served from the same origin as the API,
# so the frontend's relative `/api/...` calls work with no CORS setup. Locally,
# Vite serves the frontend and STATIC_DIR is unset. Mounted last so API routes
# take precedence.
if static_dir := os.environ.get("STATIC_DIR"):
    app.mount("/", SinglePageApp(directory=static_dir, html=True), name="frontend")
