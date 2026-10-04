from fastapi import FastAPI

from app.routes import problems

app = FastAPI(title="Reps API")
app.include_router(problems.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
