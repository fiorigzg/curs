"""T-Invest (Tinkoff Invest) client через публичный REST-gateway.

Docs: https://developer.tbank.ru/invest/intro/intro
REST-gateway зеркалит gRPC-контракт 1:1 (grpc-gateway): POST JSON на
`/<package>.<Service>/<Method>` с Bearer-токеном. Официальный pip-пакет
`tinkoff-investments` снят с PyPI (404), поэтому используем REST поверх httpx.

Покрываем:
- resolve_figi(ticker)            — динамический FIGI-резолвер (решение 1a)
- last_prices(figis)             — текущие цены
- candles(figi, days)            — дневные свечи для бэкфилла/беты (решение 2c)
- get_accounts(token)            — счета пользователя
- portfolio_positions(...)       — позиции
- operations(...)                — история операций
- test_token(token)              — проверка соединения (UsersService/GetInfo)

Цены — Quotation {units, nano}; конвертация units + nano/1e9.
Глобальный токен (settings.tinkoff_dev_token) — для market data и бэкфилла.
Пользовательский токен (из ProviderConnection, Fernet) — для синка портфеля.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import httpx
import structlog
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from curs_api.settings import settings

log = structlog.get_logger()

BASE_URL = "https://invest-public-api.tinkoff.ru/rest"
_SVC = "tinkoff.public.invest.api.contract.v1"


class TinkoffError(Exception):
    pass


def _quotation_to_float(q: dict | None) -> float:
    """Quotation/MoneyValue {units, nano} → float."""
    if not q:
        return 0.0
    return float(int(q.get("units", 0))) + float(q.get("nano", 0)) / 1e9


def _token(token: str | None = None) -> str:
    return token or settings.tinkoff_dev_token


@retry(
    retry=retry_if_exception_type((httpx.HTTPError, TinkoffError)),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    stop=stop_after_attempt(5),
    reraise=True,
)
async def _call(service: str, method: str, body: dict, token: str | None = None) -> dict:
    tok = _token(token)
    if not tok:
        raise TinkoffError("no_token")
    url = f"{BASE_URL}/{_SVC}.{service}/{method}"
    headers = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(url, json=body, headers=headers)
    if r.status_code == 429:
        log.warning("tinkoff.429", method=method)
        raise TinkoffError("rate_limited")
    if r.status_code in (401, 403):
        raise TinkoffError(f"auth_{r.status_code}")
    if r.status_code >= 500:
        raise TinkoffError(f"server_{r.status_code}")
    r.raise_for_status()
    return r.json()


async def test_token(token: str) -> bool:
    if not token:
        return False
    try:
        await _call("UsersService", "GetInfo", {}, token=token)
        return True
    except Exception as exc:  # noqa: BLE001
        log.info("tinkoff.test_fail", error=str(exc))
        return False


async def resolve_figi(ticker: str, *, token: str | None = None) -> str | None:
    """Найти FIGI по тикеру. Предпочитаем точное совпадение тикера (решение 1a)."""
    try:
        data = await _call("InstrumentsService", "FindInstrument", {"query": ticker}, token=token)
    except Exception as exc:  # noqa: BLE001
        log.warning("tinkoff.find_fail", ticker=ticker, error=str(exc))
        return None
    instruments = data.get("instruments", [])
    exact = [i for i in instruments if i.get("ticker") == ticker]
    chosen = exact[0] if exact else (instruments[0] if instruments else None)
    return chosen.get("figi") if chosen else None


# instrumentType (T-Invest) → (наш AssetClass, subclass|None)
_INSTR_TYPE_MAP: dict[str, tuple[str, str | None]] = {
    "share": ("tradfi", "Акция"),
    "bond": ("tradfi", "Облигация"),
    "etf": ("tradfi", "ETF"),
    "currency": ("fiat", None),
}


async def find_instruments(query: str, *, limit: int = 8, token: str | None = None) -> list[dict]:
    """Поиск инструментов по тикеру/названию для каталога активов.

    Возвращает кандидатов: {id(ticker), name, class, subclass, ccy, figi}.
    Best-effort: при ошибке возвращает []."""
    try:
        data = await _call("InstrumentsService", "FindInstrument", {"query": query}, token=token)
    except Exception as exc:  # noqa: BLE001
        log.info("tinkoff.search_fail", query=query, error=str(exc))
        return []
    out: list[dict] = []
    seen: set[str] = set()
    # Точные совпадения тикера — выше.
    instruments = sorted(
        data.get("instruments", []),
        key=lambda i: 0 if (i.get("ticker") or "").upper() == query.upper() else 1,
    )
    for i in instruments:
        ticker = (i.get("ticker") or "").upper()
        figi = i.get("figi")
        if not ticker or not figi or ticker in seen:
            continue
        itype = (i.get("instrumentType") or "").lower()
        cls, subclass = _INSTR_TYPE_MAP.get(itype, ("tradfi", None))
        out.append(
            {
                "id": ticker,
                "name": i.get("name") or ticker,
                "class": cls,
                "subclass": subclass,
                "ccy": (i.get("currency") or "RUB").upper(),
                "figi": figi,
                "source": "tinkoff",
            }
        )
        seen.add(ticker)
        if len(out) >= limit:
            break
    return out


async def last_prices(figis: list[str], *, token: str | None = None) -> dict[str, float]:
    """{figi: last_price}."""
    if not figis:
        return {}
    data = await _call("MarketDataService", "GetLastPrices", {"figi": figis}, token=token)
    out: dict[str, float] = {}
    for lp in data.get("lastPrices", []):
        figi = lp.get("figi")
        if figi:
            out[figi] = _quotation_to_float(lp.get("price"))
    return out


async def candles(figi: str, *, days: int = 365, token: str | None = None) -> list[tuple[datetime, float]]:
    """Дневные свечи за `days` дней. Возвращает [(ts, close), ...]."""
    to = datetime.now(timezone.utc)
    frm = to - timedelta(days=days)
    body = {
        "figi": figi,
        "from": frm.isoformat(),
        "to": to.isoformat(),
        "interval": "CANDLE_INTERVAL_DAY",
    }
    data = await _call("MarketDataService", "GetCandles", body, token=token)
    out: list[tuple[datetime, float]] = []
    for c in data.get("candles", []):
        ts_raw = c.get("time")
        if not ts_raw:
            continue
        ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
        out.append((ts, _quotation_to_float(c.get("close"))))
    return out


async def dividends(
    figi: str, *, days: int = 600, token: str | None = None
) -> list[tuple[date, float, str]]:
    """Дивиденды инструмента за период. Возвращает [(ex_date, amount_per_share, ccy)].

    InstrumentsService/GetDividends отдаёт recordDate/lastBuyDate/paymentDate. В
    качестве ex-date берём recordDate (упрощение — реальная экс-дата ≈ lastBuyDate+1
    торговый день; для корректировки adj_close этой точности достаточно, см.
    docs/analytics.md). Best-effort: при ошибке возвращает []."""
    to = datetime.now(timezone.utc)
    frm = to - timedelta(days=days)
    body = {"instrumentId": figi, "from": frm.isoformat(), "to": to.isoformat()}
    try:
        data = await _call("InstrumentsService", "GetDividends", body, token=token)
    except Exception as exc:  # noqa: BLE001
        log.info("tinkoff.dividends_fail", figi=figi, error=str(exc))
        return []
    out: list[tuple[date, float, str]] = []
    for d in data.get("dividends", []):
        net = d.get("dividendNet") or {}
        amount = _quotation_to_float(net)
        raw = d.get("recordDate") or d.get("lastBuyDate") or d.get("paymentDate")
        if not raw or amount <= 0:
            continue
        ex = datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
        out.append((ex, amount, (net.get("currency") or "rub").upper()))
    return out


async def get_accounts(token: str) -> list[str]:
    data = await _call("UsersService", "GetAccounts", {}, token=token)
    return [a["id"] for a in data.get("accounts", []) if a.get("id")]


async def portfolio_positions(token: str, account_id: str) -> list[dict]:
    """Позиции пользователя. [{figi, instrument_type, qty, avg_price, ccy}]."""
    data = await _call("OperationsService", "GetPortfolio", {"accountId": account_id}, token=token)
    out = []
    for p in data.get("positions", []):
        avg = p.get("averagePositionPrice") or {}
        out.append(
            {
                "figi": p.get("figi"),
                "instrument_type": p.get("instrumentType"),
                "qty": _quotation_to_float(p.get("quantity")),
                "avg_price": _quotation_to_float(avg),
                "ccy": (avg.get("currency") or "rub").upper(),
            }
        )
    return out


async def operations(token: str, account_id: str, *, days: int = 365) -> list[dict]:
    """История операций за период."""
    to = datetime.now(timezone.utc)
    frm = to - timedelta(days=days)
    body = {"accountId": account_id, "from": frm.isoformat(), "to": to.isoformat()}
    data = await _call("OperationsService", "GetOperations", body, token=token)
    out = []
    for op in data.get("operations", []):
        out.append(
            {
                "figi": op.get("figi"),
                "type": op.get("operationType", ""),
                "payment": _quotation_to_float(op.get("payment")),
                "price": _quotation_to_float(op.get("price")),
                "qty": int(op.get("quantity", 0) or 0),
                "date": datetime.fromisoformat(op["date"].replace("Z", "+00:00"))
                if op.get("date")
                else to,
                "ccy": (op.get("currency") or "rub").upper(),
            }
        )
    return out
