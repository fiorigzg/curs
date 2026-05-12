"""Monte Carlo прогноз стоимости портфеля: параметрический и исторический bootstrap.

Reference: Glasserman (2003), "Monte Carlo Methods in Financial Engineering".

Параметрический: доходности активов ~ MVN(μ, Σ) (дневные). Доходность портфеля —
линейная комбинация wᵀr, поэтому она РАСПРЕДЕЛЕНА КАК N(wᵀμ, wᵀΣw). Симулируем
дневные доходности портфеля напрямую из этого одномерного нормального (эквивалентно
полному MVN на уровне портфеля, но без O(N) памяти на путь) и компаундируем.

Bootstrap: ресэмплинг наблюдённых дневных доходностей портфеля с возвращением.

Выходы: распределение конечной стоимости, VaR/CVaR (95/99%), вероятность убытка,
данные fan chart по перцентилям (5/25/50/75/95).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

TRADING_DAYS = 252
MAX_SIMS = 50_000      # потолок числа путей (защита от runaway compute)
MAX_HORIZON = 2_520    # ~10 лет дневных шагов


@dataclass
class MonteCarloResult:
    method: str
    start_value: float
    horizon: int
    n_simulations: int
    terminal_mean: float
    terminal_median: float
    percentiles_terminal: dict           # {"p5":..., "p25":..., ...} конечной стоимости
    var: dict                            # {"var95":frac, "var99":frac, "var95Value":..., ...}
    cvar: dict                           # CVaR / Expected Shortfall
    prob_loss: float
    fan: dict                            # {"p5":[...], "p25":[...], ...} по шагам (len = horizon+1)
    sample_paths: list[list[float]]      # подвыборка путей для графика


def _clamp(n_sims: int, horizon: int) -> tuple[int, int]:
    return max(10, min(int(n_sims), MAX_SIMS)), max(2, min(int(horizon), MAX_HORIZON))


def _compound(daily: np.ndarray, start_value: float) -> np.ndarray:
    """(n_sims, horizon) дневных доходностей → (n_sims, horizon+1) путей стоимости."""
    growth = np.cumprod(1.0 + daily, axis=1)
    paths = np.empty((daily.shape[0], daily.shape[1] + 1))
    paths[:, 0] = start_value
    paths[:, 1:] = start_value * growth
    return paths


def _summarize(
    paths: np.ndarray,
    *,
    method: str,
    start_value: float,
    horizon: int,
    n_sims: int,
    target_growth: float,
    sample_n: int,
) -> MonteCarloResult:
    terminal = paths[:, -1]
    term_ret = terminal / start_value - 1.0

    def pct(arr: np.ndarray, q: float) -> float:
        return float(np.percentile(arr, q))

    # VaR/CVaR на уровне доходности к стартовой стоимости (положительные = убыток).
    var95_r = -pct(term_ret, 5)
    var99_r = -pct(term_ret, 1)
    q05 = np.percentile(term_ret, 5)
    q01 = np.percentile(term_ret, 1)
    tail95 = term_ret[term_ret <= q05]
    tail99 = term_ret[term_ret <= q01]
    cvar95_r = -float(tail95.mean()) if tail95.size else var95_r
    cvar99_r = -float(tail99.mean()) if tail99.size else var99_r

    fan = {
        f"p{q}": [float(v) for v in np.percentile(paths, q, axis=0)]
        for q in (5, 25, 50, 75, 95)
    }
    step = max(1, paths.shape[0] // sample_n)
    sample = [[float(v) for v in paths[i]] for i in range(0, paths.shape[0], step)][:sample_n]

    return MonteCarloResult(
        method=method,
        start_value=float(start_value),
        horizon=int(horizon),
        n_simulations=int(n_sims),
        terminal_mean=float(terminal.mean()),
        terminal_median=float(np.median(terminal)),
        percentiles_terminal={f"p{q}": pct(terminal, q) for q in (5, 25, 50, 75, 95)},
        var={
            "var95": var95_r, "var99": var99_r,
            "var95Value": float(var95_r * start_value),
            "var99Value": float(var99_r * start_value),
        },
        cvar={
            "cvar95": cvar95_r, "cvar99": cvar99_r,
            "cvar95Value": float(cvar95_r * start_value),
            "cvar99Value": float(cvar99_r * start_value),
        },
        prob_loss=float((terminal < start_value).mean()),
        fan=fan,
        sample_paths=sample,
    )


def monte_carlo_parametric(
    weights: np.ndarray | list[float],
    mu_daily: np.ndarray | list[float],
    cov_daily: np.ndarray | list[list[float]],
    *,
    start_value: float,
    horizon: int = TRADING_DAYS,
    n_simulations: int = 10_000,
    target_growth: float = 0.0,
    sample_paths: int = 80,
    seed: int = 42,
) -> MonteCarloResult:
    """Параметрический MC: дневная доходность портфеля ~ N(wᵀμ, wᵀΣw)."""
    w = np.asarray(weights, dtype=float).ravel()
    mu = np.asarray(mu_daily, dtype=float).ravel()
    cov = np.atleast_2d(np.asarray(cov_daily, dtype=float))
    n_sims, horizon = _clamp(n_simulations, horizon)

    mu_p = float(w @ mu)
    var_p = float(w @ cov @ w)
    sigma_p = float(np.sqrt(max(var_p, 0.0)))

    rng = np.random.default_rng(seed)
    daily = rng.normal(mu_p, sigma_p, size=(n_sims, horizon)) if sigma_p > 0 \
        else np.full((n_sims, horizon), mu_p)
    paths = _compound(daily, start_value)
    return _summarize(paths, method="parametric", start_value=start_value, horizon=horizon,
                      n_sims=n_sims, target_growth=target_growth, sample_n=sample_paths)


def monte_carlo_bootstrap(
    portfolio_daily_returns: np.ndarray | list[float],
    *,
    start_value: float,
    horizon: int = TRADING_DAYS,
    n_simulations: int = 10_000,
    target_growth: float = 0.0,
    sample_paths: int = 80,
    seed: int = 42,
) -> MonteCarloResult:
    """Исторический bootstrap: ресэмплинг наблюдённых дневных доходностей портфеля."""
    r = np.asarray(portfolio_daily_returns, dtype=float).ravel()
    n_sims, horizon = _clamp(n_simulations, horizon)
    if r.size < 2:
        daily = np.zeros((n_sims, horizon))
    else:
        rng = np.random.default_rng(seed)
        idx = rng.integers(0, r.size, size=(n_sims, horizon))
        daily = r[idx]
    paths = _compound(daily, start_value)
    return _summarize(paths, method="bootstrap", start_value=start_value, horizon=horizon,
                      n_sims=n_sims, target_growth=target_growth, sample_n=sample_paths)
