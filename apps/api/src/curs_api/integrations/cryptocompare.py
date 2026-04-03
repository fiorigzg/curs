"""CryptoCompare REST client (async) — многолетняя дневная история крипты.

Docs: https://developer.cryptocompare.com/
Закрывает пробел CoinGecko demo-плана (история режется до 365 дней): CryptoCompare
`histoday?limit=2000` отдаёт ~5.5 лет дневных закрытий в USD. Используется ТОЛЬКО для
бэкфилла истории; live-цены и поиск/импорт монет по-прежнему через CoinGecko.

Ключ опционален: без него запросы тоже проходят (ниже rate-limit). При наличии —
шлём заголовок `authorization: Apikey {key}`.
"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx
import structlog
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from curs_api.settings import settings

log = structlog.get_logger()

# Наш тикер → символ CryptoCompare (если отличается). По умолчанию совпадает.
TICKER_ALIASES: dict[str, str] = {
    "POL": "MATIC",  # CC хранит историю Polygon под старым символом MATIC
}

# CryptoCompare отдаёт максимум 2000 точек за запрос (без пагинации) — ~5.5 лет.
_MAX_LIMIT = 2000


class CryptoCompareError(Exception):
    pass


def _headers() -> dict:
    if settings.cryptocompare_api_key:
        return {"authorization": f"Apikey {settings.cryptocompare_api_key}"}
    return {}


@retry(
    retry=retry_if_exception_type((httpx.HTTPError, CryptoCompareError)),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    stop=stop_after_attempt(4),
    reraise=True,
)
async def _get(path: str, params: dict) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"{settings.cryptocompare_base_url}{path}", params=params, headers=_headers()
        )
    if r.status_code == 429:
        raise CryptoCompareError("rate_limited")
    if r.status_code >= 500:
        raise CryptoCompareError(f"server_{r.status_code}")
    r.raise_for_status()
    data = r.json()
    # CryptoCompare кодирует ошибки в теле: {"Response":"Error","Message": "..."}.
    if isinstance(data, dict) and data.get("Response") == "Error":
        raise CryptoCompareError(data.get("Message", "error"))
    return data


def cc_symbol(ticker: str) -> str:
    return TICKER_ALIASES.get(ticker, ticker)


async def histoday(ticker: str, *, days: int = _MAX_LIMIT, tsym: str = "USD") -> list[tuple[datetime, float]]:
    """Дневная история закрытий [(ts_utc, close), ...] в валюте tsym (по умолч. USD).

    Best-effort: при ошибке/пустом ответе возвращает [] — вызывающий откатится на
    CoinGecko."""
    try:
        data = await _get(
            "/data/v2/histoday",
            {"fsym": cc_symbol(ticker), "tsym": tsym, "limit": min(days, _MAX_LIMIT)},
        )
    except Exception as exc:  # noqa: BLE001
        log.info("cryptocompare.histoday_fail", ticker=ticker, error=str(exc))
        return []
    rows = (data.get("Data") or {}).get("Data") or []
    out: list[tuple[datetime, float]] = []
    for d in rows:
        close = d.get("close")
        ts = d.get("time")
        if close and ts and close > 0:
            out.append((datetime.fromtimestamp(int(ts), tz=timezone.utc), float(close)))
    return out
