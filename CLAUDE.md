# CLAUDE.md

## Project overview

Reps is a spaced-repetition tracker for LeetCode practice. The user logs
problems and attempts, a scheduler decides when to revisit each problem, and
a "today's queue" shows what's due. Single user, no auth.

See TREE.md for the trunk, MVP leaves, and later branches. Build only the leaf
the user has asked for.

## Stack

Chosen to match common industry practice (the user is targeting full-stack
and MLE roles). Propose changes, with reasons, before deviating.

- `backend/`: Python 3.12, FastAPI (JSON API under `/api`), SQLAlchemy 2.0,
  PostgreSQL, Alembic migrations, pytest. Dependencies managed with uv
  (`pyproject.toml` + `uv.lock`).
- `frontend/`: React + TypeScript built with Vite, Vitest + React Testing
  Library. Dependencies managed with npm. Requires Node 24 LTS.
- `docker-compose.yml`: runs PostgreSQL locally.
- `.github/workflows/`: CI runs backend and frontend tests on every push.

## Commands

```bash
# Database (from repo root)
docker compose up -d db                  # start Postgres in the background
docker compose down                      # stop it (data persists in a volume)

# Backend (from backend/)
uv sync                                  # create .venv, install deps (incl. Python 3.12)
uv run uvicorn app.main:app --reload     # API at http://127.0.0.1:8000, docs at /docs
uv run pytest                            # run all backend tests
uv add <package>                         # add a runtime dependency
uv add --dev <package>                   # add a dev/test dependency

# Frontend (from frontend/)
npm install                              # install deps
npm run dev                              # app at http://localhost:5173
npm test                                 # run frontend tests
```

## About the user

Wants to read andunderstand the code, not type it all.

## How to work with the user

1. Write the code, but explain each meaningful change and why, in plain
   language. Skip obvious boilerplate. Explanations go in chat, not in the
   code: comment only the non-obvious why.
2. Never silently fix anything. 
3. Flag assumptions and tradeoffs in anything non-trivial. If there's a
   simpler or more standard way, say so.
4. Keep changes small enough that the user can read the whole diff.
5. Call out what to double-check: edge cases, security, happy-path-only
   behavior.
6. After a significant piece, ask ONE question about the part most likely to
   bite later. If the user says "I don't follow this," stop and explain it
   differently before continuing.
7. Be direct. If the user's idea or code has a real problem, say so.
8. Commit messages: one-line subject, no body.

## Product rules

- Never store LeetCode problem statements. Store only: problem number, title,
  link, the user's pattern label, difficulty, and the user's own notes.
- Do not scrape LeetCode or call its unofficial endpoints.
- The user picks the pattern from a dropdown (sliding window, two pointers,
  binary search, DP, graphs, trees, heap, backtracking, stack, intervals,
  etc.). The exact list is fixed in the data-model leaf.
