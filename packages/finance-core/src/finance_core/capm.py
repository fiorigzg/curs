"""CAPM: по-активные метрики, бета/альфа Дженсена, SML.

Reference: Sharpe (1964), Lintner (1965); Bodie/Kane/Marcus, ch. 9.
Работаем с ПРОСТЫМИ дневными доходностями (см. docs/analytics.md) и аннуализируем
по 252 торговым дням.

    β_i = Cov(r_i, r_m) / Var(r_m)
    α_i (Дженсена, дневная) = E(r_i) − [r_f + β_i·(E(r_m) − r_f)]
    R²  — доля дисперсии r_i, объяснённая рынком
    σ(ε_i) — стандартное отклонение остатков регрессии (идиосинкратический риск)

SML: E(r) = r_f + β·(E(r_m) − r_f).
"""
from __future__ import annotations

import numpy as np

from finance_core.regression import ols

TRADING_DAYS = 252
MIN_OBS = 30  # минимум наблюдений для market-relative метрик


def daily_rf_from_annual(rf_annual: float) -> float:
    """Годовая безрисковая ставка → дневная: (1 + rf)^(1/252) − 1."""
    return (1.0 + rf_annual) ** (1.0 / TRADING_DAYS) - 1.0


def annualize_return(mean_daily: float) -> float:
    """Арифметическая аннуализация средней дневной доходности (для CAPM)."""
    return mean_daily * TRADING_DAYS


def annualize_vol(std_daily: float) -> float:
    return std_daily * np.sqrt(TRADING_DAYS)


def capm_metrics(
    asset_returns: np.ndarray | list[float],
    market_returns: np.ndarray | list[float],
    rf_annual: float = 0.0,
) -> dict:
    """Полный набор по-активных метрик. Возвращает JSON-совместимый dict.

    При нехватке данных (< MIN_OBS совпавших наблюдений) или нулевой дисперсии
    рынка возвращает {"insufficient_data": True, ...} с тем, что удалось посчитать.
    """
    r_i = np.asarray(asset_returns, dtype=float).ravel()
    r_m = np.asarray(market_returns, dtype=float).ravel()
    n = min(r_i.shape[0], r_m.shape[0])
    r_i, r_m = r_i[:n], r_m[:n]

    mean_daily = float(r_i.mean()) if n else 0.0
    std_daily = float(r_i.std(ddof=1)) if n > 1 else 0.0
    out: dict = {
        "mean_daily": mean_daily,
        "ann_return": annualize_return(mean_daily),
        "ann_vol": annualize_vol(std_daily),
        "n_obs": int(n),
    }

    if n < MIN_OBS:
        out.update(insufficient_data=True, beta=None, alpha=None, r_squared=None, idio_vol=None)
        return out

    var_m = float(r_m.var(ddof=1))
    if var_m <= 0:
        # Нулевая дисперсия рынка — бета не определена.
        out.update(insufficient_data=True, beta=None, alpha=None, r_squared=None, idio_vol=None)
        return out

    rf_d = daily_rf_from_annual(rf_annual)
    # Регрессия (r_i − rf) на (r_m − rf): intercept = α Дженсена, наклон = β.
    res = ols(r_i - rf_d, r_m - rf_d, add_const=True, param_names=["beta"])
    alpha_daily, beta = res.params[0], res.params[1]

    out.update(
        insufficient_data=False,
        beta=float(beta),
        alpha=annualize_return(float(alpha_daily)),  # α аннуализированная
        alpha_daily=float(alpha_daily),
        r_squared=float(res.r_squared),
        idio_vol=annualize_vol(float(res.resid_std)),
        beta_p_value=float(res.p_values[1]),
        alpha_p_value=float(res.p_values[0]),
    )
    return out


def sml_params(rf_annual: float, market_ann_return: float) -> dict:
    """Линия рынка ценных бумаг (SML): E(r) = rf + β·(E(rm) − rf).

    Возвращает {intercept: rf, slope: (rm − rf)} — наклон и пересечение по оси β.
    """
    return {"intercept": float(rf_annual), "slope": float(market_ann_return - rf_annual)}
