"""CoinGecko REST client (async).

Docs: https://docs.coingecko.com/
Demo-план: 30 req/min, ключ через query `x_cg_demo_api_key`.
- /ping                                  — проверка соединения
- /simple/price                          — текущие цены
- /coins/{id}/market_chart?days=N        — историческая цена (для бэкфилла и беты)
- /global                                — суммарная market cap (крипто-бенчмарк)

При 429 / 5xx — экспоненциальный backoff (tenacity). Уважаем rate-limit через
общий RateLimiter в Redis (30/min для demo).
"""
from __future__ import annotations

import httpx
import structlog
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from curs_api.integrations.cache import RateLimiter, cache_get_json, cache_set_json
from curs_api.settings import settings

log = structlog.get_logger()

BASE_URL = "https://api.coingecko.com/api/v3"

# CoinGecko id для тикеров крипты из нашего каталога.
TICKER_TO_CG_ID = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "SOL": "solana",
    "USDT": "tether",
    "USDC": "usd-coin",
    "TON": "the-open-network",
    "BNB": "binancecoin",
    "XRP": "ripple",
    "ADA": "cardano",
    "DOGE": "dogecoin",
    "TRX": "tron",
    "DOT": "polkadot",
    "AVAX": "avalanche-2",
    "LTC": "litecoin",
    "LINK": "chainlink",
    "MATIC": "matic-network",
    "POL": "polygon-ecosystem-token",
}

_PLAN_RPM = {"demo": 30, "analyst": 500, "pro": 500, "enterprise": 1000}
_rate_limiter = RateLimiter("coingecko", _PLAN_RPM.get(settings.coingecko_plan, 30))


class CoinGeckoError(Exception):
    pass


def _params(extra: dict | None = None) -> dict:
    p = dict(extra or {})
    if settings.coingecko_api_key:
        p["x_cg_demo_api_key"] = settings.coingecko_api_key
    return p


@retry(
    retry=retry_if_exception_type((httpx.HTTPError, CoinGeckoError)),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    stop=stop_after_attempt(5),
    reraise=True,
)
async def _get(path: str, params: dict | None = None) -> dict | list:
    await _rate_limiter.acquire()
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{BASE_URL}{path}", params=_params(params))
    if r.status_code == 429:
        log.warning("coingecko.429", path=path)
        raise CoinGeckoError("rate_limited")
    if r.status_code >= 500:
        raise CoinGeckoError(f"server_{r.status_code}")
    r.raise_for_status()
    return r.json()


async def ping() -> bool:
    try:
        data = await _get("/ping")
        return "gecko_says" in data
    except Exception:  # noqa: BLE001
        return False


async def search_coins(query: str, *, limit: int = 8) -> list[dict]:
    """Поиск монет по названию/символу для каталога.

    Возвращает кандидатов: {id(symbol), name, class:crypto, ccy:USD, coingeckoId}.
    Best-effort: при ошибке возвращает []."""
    try:
        data = await _get("/search", {"query": query})
    except Exception as exc:  # noqa: BLE001
        log.info("coingecko.search_fail", query=query, error=str(exc))
        return []
    out: list[dict] = []
    seen: set[str] = set()
    for c in (data.get("coins", []) if isinstance(data, dict) else []):
        symbol = (c.get("symbol") or "").upper()
        cg_id = c.get("id")
        if not symbol or not cg_id or symbol in seen:
            continue
        out.append(
            {
                "id": symbol,
                "name": c.get("name") or symbol,
                "class": "crypto",
                "subclass": None,
                "ccy": "USD",
                "coingeckoId": cg_id,
                "source": "coingecko",
            }
        )
        seen.add(symbol)
        if len(out) >= limit:
            break
    return out


async def simple_prices(cg_ids: list[str], vs: str = "usd") -> dict[str, float]:
    """Возвращает {cg_id: price_in_vs}."""
    if not cg_ids:
        return {}
    data = await _get(
        "/simple/price",
        {"ids": ",".join(cg_ids), "vs_currencies": vs},
    )
    return {k: v.get(vs) for k, v in data.items() if isinstance(v, dict)}


async def prices_by_ticker(tickers: list[str]) -> dict[str, float]:
    """{TICKER: price_usd} для известных крипто-тикеров."""
    pairs = [(t, TICKER_TO_CG_ID[t]) for t in tickers if t in TICKER_TO_CG_ID]
    if not pairs:
        return {}
    by_id = await simple_prices([cid for _, cid in pairs])
    return {tkr: by_id[cid] for tkr, cid in pairs if by_id.get(cid) is not None}


async def market_chart(cg_id: str, days: int = 365, vs: str = "usd") -> list[tuple[int, float]]:
    """Историческая цена. Возвращает [(unix_ms, price), ...].

    Для days>90 CoinGecko отдаёт daily-гранулярность автоматически.
    """
    data = await _get(
        f"/coins/{cg_id}/market_chart",
        {"vs_currency": vs, "days": days, "interval": "daily"},
    )
    return [(int(ts), float(px)) for ts, px in data.get("prices", [])]


async def global_market_cap(vs: str = "usd") -> float | None:
    """TOTAL market cap для крипто-бенчмарка (кэш 1ч)."""
    cached = await cache_get_json("coingecko:global_mcap")
    if cached is not None:
        return cached
    data = await _get("/global")
    mcap = data.get("data", {}).get("total_market_cap", {}).get(vs)
    if mcap is not None:
        await cache_set_json("coingecko:global_mcap", mcap, ttl_sec=3600)
    return mcap
