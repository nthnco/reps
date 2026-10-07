# Production image: builds the React app, then runs FastAPI serving both the
# API and the built frontend from one origin.

FROM node:24-slim AS frontend
WORKDIR /app/frontend
# Dependencies first so this layer is cached until package-lock.json changes.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /bin/uv
WORKDIR /app/backend
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist

ENV PATH="/app/backend/.venv/bin:$PATH" STATIC_DIR=/app/frontend/dist
# Migrate, then serve. `exec` hands PID 1 to uvicorn so it receives the
# platform's shutdown signal. --proxy-headers lets the app see the original
# https scheme behind the host's load balancer.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
