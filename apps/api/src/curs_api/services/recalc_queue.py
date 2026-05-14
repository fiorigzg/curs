"""Лёгкая очередь задач пересчёта аналитики на Redis (без Celery/BullMQ).

Архитектура уже Redis-центрична (кэш интеграций, pub/sub для WS), поэтому очередь
строим на тех же примитивах:

  recalc:queue            — список job_id (LPUSH из API, BRPOP воркером)
  recalc:job:{id}         — хэш статуса задачи (status/progress/sections/error/…)
  recalc:active:{pf_id}   — указатель на активную задачу портфеля (идемпотентность)

Идемпотентность: если для портфеля уже есть незавершённая задача — её id и
возвращаем, новую не создаём (см. enqueue_recalc).
"""
from __future__ import annotations

import json
import time
from typing import Any
from uuid import uuid4

from curs_api.integrations.cache import get_redis

# Порядок секций пересчёта (фиксированный pipeline).
SECTIONS: list[str] = [
    "per_asset",
    "risk",
    "capm",
    "correlation",
    "pairwise",
    "optimization",
    "monte_carlo",
]

QUEUE_KEY = "recalc:queue"
JOB_TTL_SEC = 24 * 3600
ACTIVE_TTL_SEC = 2 * 3600

_TERMINAL = {"done", "failed"}


def _job_key(job_id: str) -> str:
    return f"recalc:job:{job_id}"


def _active_key(portfolio_id: str) -> str:
    return f"recalc:active:{portfolio_id}"


def _encode(value: Any) -> str:
    return value if isinstance(value, str) else json.dumps(value)


def _decode_job(raw: dict[str, str]) -> dict:
    if not raw:
        return {}
    return {
        "id": raw.get("id"),
        "portfolioId": raw.get("portfolioId"),
        "status": raw.get("status", "queued"),
        "progress": int(raw.get("progress", "0")),
        "sections": json.loads(raw.get("sections", "[]")),
        "doneSections": json.loads(raw.get("doneSections", "[]")),
        "params": json.loads(raw.get("params", "{}")),
        "error": raw.get("error") or None,
        "createdAt": raw.get("createdAt"),
        "updatedAt": raw.get("updatedAt"),
    }


async def get_job(job_id: str) -> dict | None:
    raw = await get_redis().hgetall(_job_key(job_id))
    return _decode_job(raw) if raw else None


async def _write_job(job_id: str, fields: dict[str, Any]) -> None:
    r = get_redis()
    mapping = {k: _encode(v) for k, v in fields.items()}
    mapping["updatedAt"] = str(time.time())
    await r.hset(_job_key(job_id), mapping=mapping)
    await r.expire(_job_key(job_id), JOB_TTL_SEC)


async def enqueue_recalc(
    portfolio_id: str, sections: list[str] | None, params: dict | None = None
) -> tuple[dict, bool]:
    """Поставить задачу. Возвращает (job, created).

    created=False, если вернули уже существующую активную задачу портфеля.
    """
    r = get_redis()
    active_id = await r.get(_active_key(portfolio_id))
    if active_id:
        existing = await get_job(active_id)
        if existing and existing["status"] not in _TERMINAL:
            return existing, False

    sections = [s for s in (sections or SECTIONS) if s in SECTIONS] or list(SECTIONS)
    job_id = str(uuid4())
    now = str(time.time())
    await _write_job(job_id, {
        "id": job_id,
        "portfolioId": portfolio_id,
        "status": "queued",
        "progress": 0,
        "sections": sections,
        "doneSections": [],
        "params": params or {},
        "error": "",
        "createdAt": now,
    })
    await r.set(_active_key(portfolio_id), job_id, ex=ACTIVE_TTL_SEC)
    await r.lpush(QUEUE_KEY, job_id)
    job = await get_job(job_id)
    return job or {}, True


async def pop_job(timeout: int = 5) -> str | None:
    """Блокирующее извлечение job_id из очереди (для воркера)."""
    res = await get_redis().brpop(QUEUE_KEY, timeout=timeout)
    if not res:
        return None
    # brpop → (key, value)
    return res[1] if isinstance(res, (list, tuple)) else res


async def mark_running(job_id: str) -> None:
    await _write_job(job_id, {"status": "running", "progress": 1})


async def set_progress(
    job_id: str, progress: int, *, done_section: str | None = None
) -> None:
    fields: dict[str, Any] = {"progress": max(0, min(100, int(progress)))}
    if done_section:
        job = await get_job(job_id)
        done = job["doneSections"] if job else []
        if done_section not in done:
            done.append(done_section)
        fields["doneSections"] = done
    await _write_job(job_id, fields)


async def mark_done(job_id: str, portfolio_id: str) -> None:
    await _write_job(job_id, {"status": "done", "progress": 100})
    await get_redis().delete(_active_key(portfolio_id))


async def mark_failed(job_id: str, portfolio_id: str, error: str) -> None:
    await _write_job(job_id, {"status": "failed", "error": error[:500]})
    await get_redis().delete(_active_key(portfolio_id))
