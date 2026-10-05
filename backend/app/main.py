from fastapi import FastAPI

from app.routes import problems, queue

app = FastAPI(title="Reps API")
app.include_router(problems.router)
app.include_router(queue.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
