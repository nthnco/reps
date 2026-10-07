import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.routes import problems, queue

app = FastAPI(title="Reps API")
app.include_router(problems.router)
app.include_router(queue.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# In production the built React app is served from the same origin as the API,
# so the frontend's relative `/api/...` calls work with no CORS setup. Locally,
# Vite serves the frontend and STATIC_DIR is unset. Mounted last so API routes
# take precedence.
if static_dir := os.environ.get("STATIC_DIR"):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
