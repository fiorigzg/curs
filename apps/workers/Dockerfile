# syntax=docker/dockerfile:1.7
# ============================================================
# CURS — Workers image
# ============================================================
# Контекст билда — корень монорепо. Сохраняем layout, чтобы относительные
# path-зависимости (curs-api=../api, finance-core=../../packages/finance-core)
# резолвились так же, как локально.

FROM python:3.12-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.5.4 /uv /uvx /usr/local/bin/

# Сохраняем структуру репозитория под /repo.
WORKDIR /repo
COPY packages/finance-core /repo/packages/finance-core
COPY apps/api /repo/apps/api
COPY apps/workers/pyproject.toml /repo/apps/workers/

WORKDIR /repo/apps/workers
RUN --mount=type=cache,target=/root/.cache/uv \
    uv venv .venv && \
    uv sync --no-install-project

COPY apps/workers/src /repo/apps/workers/src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev

# ------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/repo/apps/workers/.venv/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r curs && useradd -r -g curs -d /repo curs

WORKDIR /repo/apps/workers
COPY --from=builder --chown=curs:curs /repo /repo

USER curs

CMD ["python", "-m", "curs_workers.supervisor"]
