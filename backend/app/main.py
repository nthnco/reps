from fastapi import FastAPI

app = FastAPI(title="Reps API")


@app.get("/api/health")
def health():
    return {"status": "ok"}
