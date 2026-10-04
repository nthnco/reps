# Reps

A spaced-repetition tracker for LeetCode practice.

Log the problems you solve and each attempt at them. A scheduler decides when
you should revisit each problem based on how it went, and a "today's queue"
shows what's due. Reps stores only metadata and your own notes (number,
title, link, pattern, difficulty), never problem statements.

> Status: scaffold only. No features are implemented yet.

## Stack

| Layer    | Choice                                   |
|----------|------------------------------------------|
| Frontend | React + TypeScript (Vite), Vitest        |
| Backend  | FastAPI (Python 3.12), pytest            |
| Database | PostgreSQL, SQLAlchemy 2.0, Alembic      |
| Tooling  | uv, npm, Docker Compose, GitHub Actions  |

**Why this stack:** it mirrors what's common in industry for full-stack and
ML engineering work. FastAPI is the usual choice for serving Python and ML
code, which matters for the learned scheduler and pattern classifier later.
React + TypeScript is the most widely used frontend, and Postgres is the
default production database. The cost is two codebases (Python and
TypeScript) and a database server to run locally, which Docker handles.

## Running it

Requires [uv](https://docs.astral.sh/uv/), Node 24 LTS, and Docker.

```bash
# 1. Database
docker compose up -d db

# 2. Backend (in one terminal)
cd backend
uv sync
uv run uvicorn app.main:app --reload    # http://127.0.0.1:8000/docs

# 3. Frontend (in another terminal)
cd frontend
npm install
npm run dev                             # http://localhost:5173
```

Tests: `uv run pytest` in `backend/`, `npm test` in `frontend/`.

## Project layout

```
backend/
  app/
    main.py        FastAPI app and router wiring
    models.py      SQLAlchemy models (Problem, Attempt)
    scheduler.py   next-review logic, a pure function
    routes/        one router per area
  tests/
frontend/
  src/             React components and pages
docker-compose.yml Postgres for local development
```

## Roadmap

MVP: add a problem, log an attempt, the scheduler sets the next review, and
today's queue shows what's due.

Later, in order:

1. Pattern mastery view (per-pattern confidence and speed)
2. GitHub linking via the official API (detect commits, auto-log attempts)
3. Learned scheduler (FSRS-style), evaluated against SM-2 on real history
4. Pattern classifier that suggests a label from solution code
5. Company readiness as pattern coverage, once the data supports it
6. Accounts and a shareable demo

See [TREE.md](TREE.md) for details.
