"""Портфельные метрики.

Reference: Bodie/Kane/Marcus "Investments" 12th ed., ch. 24.
- vol: σ_annual = σ_daily × √252
- Sharpe: (R_p − R_f) / σ_p (Sharpe 1966)
- Sortino: (R_p − R_f) / σ_downside (Sortino & Price 1994)
- max drawdown: max over t of (peak − value_t) / peak
- CAGR: (V_end / V_start)^(252/n) − 1 для дневных n точек
"""
from __future__ import annotations

import math
from collections.abc import Sequence

from finance_core.returns import simple_returns

TRADING_DAYS = 252


def _mean(xs: Sequence[float]) -> float:
    n = len(xs)
    return sum(xs) / n if n else 0.0


def _stdev(xs: Sequence[float], mean: float | None = None) -> float:
    n = len(xs)
    if n < 2:
        return 0.0
    m = mean if mean is not None else _mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / n)


def annualized_volatility(prices: Sequence[float]) -> float:
    rets = simple_returns(prices)
    return _stdev(rets) * math.sqrt(TRADING_DAYS) if rets else 0.0


def cagr(prices: Sequence[float]) -> float:
    if len(prices) < 2 or prices[0] <= 0:
        return 0.0
    n_days = len(prices) - 1
    ratio = prices[-1] / prices[0]
    if ratio <= 0:
        return 0.0
    return ratio ** (TRADING_DAYS / n_days) - 1.0


def sharpe_ratio(prices: Sequence[float], risk_free: float = 0.07) -> float:
    vol = annualized_volatility(prices)
    if vol == 0:
        return 0.0
    return (cagr(prices) - risk_free) / vol


def sortino_ratio(prices: Sequence[float], risk_free: float = 0.07) -> float:
    rets = simple_returns(prices)
    if not rets:
        return 0.0
    daily_rf = risk_free / TRADING_DAYS
    downside = [(r - daily_rf) for r in rets if r < daily_rf]
    if not downside:
        return 0.0
    downside_std = math.sqrt(sum(d * d for d in downside) / len(rets)) * math.sqrt(TRADING_DAYS)
    if downside_std == 0:
        return 0.0
    return (cagr(prices) - risk_free) / downside_std


def max_drawdown(prices: Sequence[float]) -> tuple[float, int]:
    """Returns (max_dd_as_negative_fraction, index_of_trough)."""
    if not prices:
        return 0.0, 0
    peak = prices[0]
    max_dd = 0.0
    trough_idx = 0
    for i, p in enumerate(prices):
        if p > peak:
            peak = p
        dd = (p - peak) / peak if peak > 0 else 0.0
        if dd < max_dd:
            max_dd = dd
            trough_idx = i
    return max_dd, trough_idx


def calmar_ratio(prices: Sequence[float]) -> float:
    dd, _ = max_drawdown(prices)
    if dd == 0:
        return 0.0
    return cagr(prices) / abs(dd)


def all_metrics(prices: Sequence[float], risk_free: float = 0.07) -> dict[str, float]:
    """Все метрики одним вызовом."""
    dd, _ = max_drawdown(prices)
    return {
        "vol": annualized_volatility(prices),
        "sharpe": sharpe_ratio(prices, risk_free),
        "sortino": sortino_ratio(prices, risk_free),
        "max_dd": dd,
        "ann_ret": cagr(prices),
        "cagr": cagr(prices),
        "calmar": calmar_ratio(prices),
    }


def drawdown_series(prices: Sequence[float]) -> list[float]:
    """Returns dd_t = (P_t − running_peak_t) / running_peak_t for each t."""
    if not prices:
        return []
    peak = prices[0]
    out = []
    for p in prices:
        if p > peak:
            peak = p
        out.append((p - peak) / peak if peak > 0 else 0.0)
    return out
