"""MOEX ISS — дневная история биржевых индексов (бенчмарки, публично, без токена).

Используется для бенчмарка IMOEX (Индекс МосБиржи). ISS отдаёт постранично, поэтому
ходим с курсором `start` до исчерпания. Кэш в Redis (12ч): история индекса меняется
раз в день.

Docs: https://iss.moex.com/iss/reference/
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import httpx
import structlog
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from curs_api.integrations.cache import cache_get_json, cache_set_json

log = structlog.get_logger()

BASE_URL = "https://iss.moex.com/iss"


@retry(
    retry=retry_if_exception_type(httpx.HTTPError),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    stop=stop_after_attempt(4),
    reraise=True,
)
async def _fetch(url: str, params: dict) -> dict:
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url, params=params)
    r.raise_for_status()
    return r.json()


async def index_history(secid: str = "IMOEX", *, days: int = 600) -> list[tuple[date, float]]:
    """Дневная история закрытий индекса за `days` дней. [(date, close), ...].

    Best-effort: при ошибке возвращает []. Результат кэшируется на 12ч."""
    cache_key = f"moex:index:{secid}:{days}"
    cached = await cache_get_json(cache_key)
    if cached is not None:
        return [(date.fromisoformat(d), float(v)) for d, v in cached]

    frm = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    url = f"{BASE_URL}/history/engines/stock/markets/index/securities/{secid}.json"
    out: list[tuple[date, float]] = []
    try:
        start = 0
        while True:
            data = await _fetch(
                url,
                {
                    "from": frm,
                    "start": start,
                    "iss.meta": "off",
                    "history.columns": "TRADEDATE,CLOSE",
                },
            )
            block = data.get("history", {})
            cols = block.get("columns", [])
            rows = block.get("data", [])
            if not rows:
                break
            di = cols.index("TRADEDATE")
            ci = cols.index("CLOSE")
            for row in rows:
                d_raw, close = row[di], row[ci]
                if d_raw and close is not None:
                    out.append((date.fromisoformat(d_raw), float(close)))
            start += len(rows)
            if len(rows) < 100:  # последняя страница ISS — < лимита
                break
        if out:
            await cache_set_json(
                cache_key, [[d.isoformat(), v] for d, v in out], ttl_sec=43200
            )
        return out
    except Exception as exc:  # noqa: BLE001
        log.warning("moex.index_history_fail", secid=secid, error=str(exc))
        return out
