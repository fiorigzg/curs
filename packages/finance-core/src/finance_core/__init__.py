"""Quantitative finance primitives.

Stage 2:
- returns: log/simple returns from price series
- metrics: vol, sharpe, sortino, max_dd, cagr, calmar
- structure: treemap aggregation
- correlation: Pearson matrix (на ценах и на доходностях, скользящая корреляция)
- frontier: Markowitz efficient frontier (Monte Carlo cloud → upper envelope)
- montecarlo: GBM path simulation with percentile fans
- monthly_returns: per-month grouping

Stage 5 (риск-менеджмент и портфельная аналитика):
- adjust: total-return корректировка close на дивиденды (adjusted close)
- regression: OLS с p-values (на numpy/scipy)
- capm: β, α Дженсена, R², идиосинкратическая σ, SML
- optimize: min-var/tangency веса, эффективная граница, 2-активные формулы, hedge ratio, CML
- risk: бета портфеля, моделирование рыночного шока (модель + эмпирика)
- mc: мультивариативный Monte Carlo (параметрический + bootstrap), VaR/CVaR/ES, fan chart
"""
from finance_core import (
    adjust,
    capm,
    correlation,
    frontier,
    mc,
    metrics,
    montecarlo,
    monthly_returns,
    optimize,
    regression,
    returns,
    risk,
    structure,
)

__all__ = [
    "returns",
    "metrics",
    "structure",
    "correlation",
    "frontier",
    "montecarlo",
    "monthly_returns",
    "adjust",
    "regression",
    "capm",
    "optimize",
    "risk",
    "mc",
]
