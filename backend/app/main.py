import os

from fastapi import Depends, FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app import auth
from app.routes import problems, queue

THIRTY_DAYS = 30 * 24 * 60 * 60

app = FastAPI(title="Reps API")
app.state.auth = auth.load_auth_config()
app.add_middleware(
    SessionMiddleware,
    # With the gate off nothing meaningful is stored, so any key will do.
    secret_key=app.state.auth.secret_key or "dev-only-not-secret",
    max_age=THIRTY_DAYS,
    same_site="lax",
    https_only=app.state.auth.required,
)

app.include_router(auth.router)
login_required = [Depends(auth.require_login)]
app.include_router(problems.router, dependencies=login_required)
app.include_router(queue.router, dependencies=login_required)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# In production the built React app is served from the same origin as the API,
# so the frontend's relative `/api/...` calls work with no CORS setup. Locally,
# Vite serves the frontend and STATIC_DIR is unset. Mounted last so API routes
# take precedence.
if static_dir := os.environ.get("STATIC_DIR"):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
