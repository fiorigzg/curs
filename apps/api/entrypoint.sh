#!/bin/sh
set -e

# Применить миграции при старте контейнера (idempotent).
# Если БД ещё не инициализирована aerich — fallback на init-db.
echo "[entrypoint] applying migrations..."
if ! /app/.venv/bin/aerich upgrade 2>&1 | tail -5; then
    echo "[entrypoint] upgrade failed, trying init-db..."
    /app/.venv/bin/aerich init-db || true
fi

echo "[entrypoint] starting uvicorn..."
exec "$@"
