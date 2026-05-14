"""Слой доступа к данным для аналитического движка.

Готовит ВЫРОВНЕННЫЕ дневные простые доходности активов портфеля, рыночного
бенчмарка и безрисковую ставку из таблицы ``asset_prices``. Всё приводится к
рублям (база приложения): нативная adj_close актива умножается на курс его
валюты к ₽ (FX-ряд из asset_prices фиатного актива). Так беты/корреляции/
оптимизация считаются в одной валюте, согласованно с оценкой портфеля.

Рыночный бенчмарк портфеля — бенчмарк актива с наибольшим весом (по умолчанию
IMOEX). Все беты считаются относительно него (см. docs/analytics.md).

Никакой математики здесь нет — только I/O и выравнивание; формулы в finance_core.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

import structlog

from curs_api.models import (
    Asset,
    AssetClass,
    AssetPrice,
    Portfolio,
    RiskFreeRate,
    RiskFreeRegion,
)
from curs_api.services.valuation import compute_holdings, value_position_in_base

log = structlog.get_logger()

MIN_OBS = 30  # минимум совпавших торговых дней для рыночных метрик

# Подбор бенчмарка по активу (зеркалит workers.price_history.benchmark_id_for).
def benchmark_id_for(asset: Asset) -> str:
    if asset.asset_class == AssetClass.CRYPTO:
        return "BTC"
    if (asset.ccy or "RUB").upper() == "USD":
        return "SP500"
    return "IMOEX"


BENCHMARK_CCY = {"IMOEX": "RUB", "SP500": "USD", "BTC": "USD"}


@dataclass
class AnalyticsInputs:
    asset_ids: list[str]
    weights: dict[str, float]
    returns: dict[str, list[float]]      # выровненные простые доходности, длина T
    dates: list[date]                    # даты доходностей (длина T)
    prices_rub: dict[str, list[float]]   # выровненные ₽-цены, длина T+1
    market_id: str
    market_returns: list[float]          # длина T
    market_prices: list[float]           # длина T+1
    rf_annual: float
    start_value: float                   # текущая ₽-стоимость портфеля (для MC)
    insufficient: bool = False
    note: str = ""
    asset_meta: dict[str, dict] = field(default_factory=dict)  # {id: {name, class, ccy}}


async def _series(asset_id: str | None = None, benchmark_id: str | None = None) -> dict[date, float]:
    qs = AssetPrice.filter(asset_id=asset_id) if asset_id else AssetPrice.filter(benchmark_id=benchmark_id)
    rows = await qs.order_by("date").values("date", "adj_close")
    return {r["date"]: float(r["adj_close"]) for r in rows}


async def _fx_series(ccy: str) -> dict[date, float]:
    """Курс ccy→RUB по дням (adj_close фиатного актива). RUB → пусто (множитель 1)."""
    if (ccy or "RUB").upper() == "RUB":
        return {}
    fiat = await Asset.filter(asset_class=AssetClass.FIAT, ccy=ccy).first()
    if not fiat:
        return {}
    return await _series(asset_id=fiat.id)


def _to_rub(native: dict[date, float], fx: dict[date, float]) -> dict[date, float]:
    if not fx:
        return native
    out: dict[date, float] = {}
    fx_dates = sorted(fx)
    for d, px in native.items():
        rate = _ffill(fx, fx_dates, d)
        if rate is not None:
            out[d] = px * rate
    return out


def _ffill(series: dict[date, float], keys: list[float], d: date) -> float | None:
    """Значение на дату d с протяжкой назад (последняя дата ≤ d)."""
    import bisect

    pos = bisect.bisect_right(keys, d) - 1
    if pos < 0:
        return None
    return series[keys[pos]]


def _simple_returns(prices: list[float]) -> list[float]:
    return [prices[i] / prices[i - 1] - 1.0 for i in range(1, len(prices)) if prices[i - 1]]


async def _latest_rf_annual(region: RiskFreeRegion) -> float | None:
    row = await RiskFreeRate.filter(region=region).order_by("-date").first()
    return float(row.rate_annual) if row else None


async def build_inputs(portfolio: Portfolio) -> AnalyticsInputs:
    """Собрать выровненные ₽-доходности портфеля. insufficient=True, если данных мало."""
    holdings = [h for h in await compute_holdings(portfolio) if h.asset.asset_class != AssetClass.FIAT]
    empty = AnalyticsInputs(
        asset_ids=[], weights={}, returns={}, dates=[], prices_rub={},
        market_id="IMOEX", market_returns=[], market_prices=[], rf_annual=0.0,
        start_value=0.0, insufficient=True, note="нет рисковых активов в портфеле",
    )
    if len(holdings) < 1:
        return empty

    # Веса по текущей ₽-стоимости.
    values: dict[str, float] = {}
    meta: dict[str, dict] = {}
    for h in holdings:
        v = float(await value_position_in_base(h.asset, h.qty, "RUB"))
        values[h.asset.id] = v
        meta[h.asset.id] = {"name": h.asset.name, "class": str(h.asset.asset_class), "ccy": h.asset.ccy}
    total_val = sum(values.values()) or 1.0
    weights = {k: v / total_val for k, v in values.items()}

    # ₽-ценовые ряды активов.
    rub_prices: dict[str, dict[date, float]] = {}
    for h in holdings:
        native = await _series(asset_id=h.asset.id)
        if len(native) < MIN_OBS:
            continue
        fx = await _fx_series(h.asset.ccy)
        rub_prices[h.asset.id] = _to_rub(native, fx)

    if len(rub_prices) < 1:
        return AnalyticsInputs(**{**empty.__dict__, "note": "недостаточно истории цен (нужно ≥30 дней)"})

    # Рыночный бенчмарк = бенчмарк актива с наибольшим весом.
    top_asset = max(weights, key=lambda k: weights[k])
    top_obj = next(h.asset for h in holdings if h.asset.id == top_asset)
    market_id = benchmark_id_for(top_obj)
    bench_native = await _series(benchmark_id=market_id)
    bench_rub = _to_rub(bench_native, await _fx_series(BENCHMARK_CCY.get(market_id, "RUB")))

    # Общие торговые дни (пересечение) активов + бенчмарка.
    common: set[date] | None = None
    for s in list(rub_prices.values()) + ([bench_rub] if bench_rub else []):
        ks = set(s.keys())
        common = ks if common is None else (common & ks)
    common_dates = sorted(common or set())
    if len(common_dates) < MIN_OBS + 1:
        return AnalyticsInputs(**{**empty.__dict__, "note": "мало совпавших торговых дней (нужно ≥31)"})

    aligned_prices = {aid: [s[d] for d in common_dates] for aid, s in rub_prices.items() if all(d in s for d in common_dates)}
    asset_ids = list(aligned_prices.keys())
    returns = {aid: _simple_returns(px) for aid, px in aligned_prices.items()}
    ret_dates = common_dates[1:]

    market_prices = [bench_rub[d] for d in common_dates] if bench_rub else []
    market_returns = _simple_returns(market_prices) if market_prices else []

    # Безрисковая ставка: база ₽ → ключевая ставка ЦБ (RU); fallback US.
    rf = await _latest_rf_annual(RiskFreeRegion.RU)
    if rf is None:
        rf = await _latest_rf_annual(RiskFreeRegion.US)
    rf = rf if rf is not None else 0.16

    from curs_api.services.valuation import portfolio_totals

    totals = await portfolio_totals(portfolio, "RUB")

    # Перенормируем веса на активы, попавшие в выровненный набор.
    w_sub = {k: weights[k] for k in asset_ids}
    s = sum(w_sub.values()) or 1.0
    w_sub = {k: v / s for k, v in w_sub.items()}

    return AnalyticsInputs(
        asset_ids=asset_ids,
        weights=w_sub,
        returns=returns,
        dates=ret_dates,
        prices_rub=aligned_prices,
        market_id=market_id,
        market_returns=market_returns,
        market_prices=market_prices,
        rf_annual=rf,
        start_value=float(totals["total"]) or 1.0,
        insufficient=len(market_returns) < MIN_OBS,
        note="" if len(market_returns) >= MIN_OBS else "недостаточно истории бенчмарка",
        asset_meta={k: meta[k] for k in asset_ids},
    )
