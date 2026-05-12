"""Риск портфеля: бета портфеля и моделирование рыночного шока.

Reference: CAPM (линейная чувствительность к рынку) + историческая условная
оценка (conditional drop / стресс на худших рыночных днях).

    β_p = Σ w_i · β_i
    Модельное падение при «рынок −X%» ≈ β_p · X        (линейный CAPM-подход)
    Эмпирическое падение = средняя доходность портфеля в худшие K% рыночных дней
                            (или в дни, когда рынок падал не меньше |X|).
"""
from __future__ import annotations

import numpy as np

DEFAULT_SHOCKS = (-0.05, -0.10, -0.20, -0.30)


def portfolio_beta(weights: list[float], betas: list[float]) -> float:
    """β_p = Σ w_i · β_i. None-беты (insufficient_data) считаются нулевыми."""
    w = np.asarray(weights, dtype=float).ravel()
    b = np.asarray([0.0 if x is None else x for x in betas], dtype=float).ravel()
    n = min(w.shape[0], b.shape[0])
    if n == 0:
        return 0.0
    return float(w[:n] @ b[:n])


def market_shock_linear(beta_p: float, shock: float) -> float:
    """Ожидаемая доходность портфеля при движении рынка на ``shock`` (доля)."""
    return float(beta_p * shock)


def historical_conditional_drop(
    portfolio_returns: np.ndarray | list[float],
    market_returns: np.ndarray | list[float],
    *,
    worst_pct: float = 0.05,
) -> dict:
    """Средняя доходность портфеля в худшие ``worst_pct`` рыночных дней (CVaR-подобно).

    Возвращает {portfolio_mean, market_mean, n_days}. insufficient_data при <20 днях.
    """
    p = np.asarray(portfolio_returns, dtype=float).ravel()
    m = np.asarray(market_returns, dtype=float).ravel()
    n = min(p.shape[0], m.shape[0])
    p, m = p[:n], m[:n]
    if n < 20:
        return {"insufficient_data": True, "portfolio_mean": None, "market_mean": None, "n_days": int(n)}
    k = max(1, int(round(n * worst_pct)))
    worst_idx = np.argsort(m)[:k]  # дни с наименьшей доходностью рынка
    return {
        "insufficient_data": False,
        "portfolio_mean": float(p[worst_idx].mean()),
        "market_mean": float(m[worst_idx].mean()),
        "n_days": int(k),
    }


def stress_test(
    beta_p: float,
    portfolio_returns: np.ndarray | list[float],
    market_returns: np.ndarray | list[float],
    *,
    shocks: tuple[float, ...] = DEFAULT_SHOCKS,
    worst_pct: float = 0.05,
) -> dict:
    """Сценарии «рынок упал на X%»: модельная и эмпирическая оценки падения портфеля.

    Для каждого X:
      model     = β_p · X
      empirical = средняя доходность портфеля в дни, когда рынок падал ≤ X
                  (если таких дней < 3 — берём общий conditional drop по худшим K%).
    """
    p = np.asarray(portfolio_returns, dtype=float).ravel()
    m = np.asarray(market_returns, dtype=float).ravel()
    n = min(p.shape[0], m.shape[0])
    p, m = p[:n], m[:n]
    cond = historical_conditional_drop(p, m, worst_pct=worst_pct)
    fallback = cond["portfolio_mean"] if not cond.get("insufficient_data") else None

    scenarios = []
    for x in shocks:
        model = market_shock_linear(beta_p, x)
        empirical = None
        if n >= 20:
            mask = m <= x
            if int(mask.sum()) >= 3:
                empirical = float(p[mask].mean())
            else:
                empirical = fallback
        scenarios.append({
            "shock": float(x),
            "model": float(model),
            "empirical": (float(empirical) if empirical is not None else None),
        })
    return {
        "beta_p": float(beta_p),
        "scenarios": scenarios,
        "conditional_worst": cond,
        "worst_pct": worst_pct,
    }
