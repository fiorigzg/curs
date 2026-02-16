# syntax=docker/dockerfile:1.7
# ============================================================
# CURS — API image
# ============================================================
# Контекст билда — корень монорепо, чтобы зацепить packages/finance-core.

FROM python:3.12-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.5.4 /uv /uvx /usr/local/bin/

WORKDIR /app

# finance-core кладём в фиксированное место. Путь должен совпадать с tool.uv.sources в pyproject.
COPY packages/finance-core /packages/finance-core

COPY apps/api/pyproject.toml ./
# Перенаправляем uv на абсолютный путь внутри образа.
RUN sed -i 's|path = "../../packages/finance-core"|path = "/packages/finance-core"|' pyproject.toml

RUN --mount=type=cache,target=/root/.cache/uv \
    uv venv .venv && \
    uv sync --no-install-project

COPY apps/api/src ./src
COPY apps/api/migrations ./migrations
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev

# ------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r curs && useradd -r -g curs -d /app curs

WORKDIR /app
COPY --from=builder --chown=curs:curs /app /app
COPY --chown=curs:curs apps/api/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER curs

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "curs_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
