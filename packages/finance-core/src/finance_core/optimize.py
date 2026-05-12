"""Портфельная оптимизация по Марковицу.

Reference: Markowitz (1952); Merton (1972) closed-form frontier.
Все входы — АННУАЛИЗИРОВАННЫЕ: ``mu`` (N,) — годовые ожидаемые доходности,
``cov`` (N×N) — годовая ковариационная матрица доходностей, ``rf`` — годовая
безрисковая ставка. По умолчанию long-only (w_i ≥ 0, Σw=1); флаг allow_short
разрешает короткие позиции (тогда используем закрытые формы).

Функции:
- mean_cov           — μ и Σ из набора рядов доходностей (аннуализация ×252)
- portfolio_perf     — (ret, vol, sharpe) для весов
- min_variance_weights, tangency_weights
- efficient_frontier — точки границы + min-var + tangency
- two_asset_min_var, two_asset_max_sharpe — закрытые формы для пары
- hedge_ratio        — OLS hedge ratio и достигнутое снижение дисперсии
- cml_params         — линия рынка капитала (CML)
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize

TRADING_DAYS = 252


# ─────────────────────────── подготовка μ, Σ ───────────────────────────
def _stack(returns: list[np.ndarray] | np.ndarray) -> np.ndarray:
    """Список из N рядов доходностей → матрица (T × N) по min длине."""
    arrs = [np.asarray(r, dtype=float).ravel() for r in returns]
    if not arrs:
        return np.empty((0, 0))
    t = min(a.shape[0] for a in arrs)
    return np.column_stack([a[:t] for a in arrs])


def mean_cov(returns: list[np.ndarray], *, annualize: bool = True) -> tuple[np.ndarray, np.ndarray]:
    """μ (N,) и Σ (N×N) из дневных доходностей. Аннуализация: μ×252, Σ×252."""
    R = _stack(returns)
    if R.size == 0 or R.shape[0] < 2:
        n = len(returns)
        return np.zeros(n), np.zeros((n, n))
    mu = R.mean(axis=0)
    cov = np.cov(R, rowvar=False, ddof=1)
    cov = np.atleast_2d(cov)
    if annualize:
        mu = mu * TRADING_DAYS
        cov = cov * TRADING_DAYS
    return mu, cov


def _inv(cov: np.ndarray) -> np.ndarray:
    try:
        return np.linalg.inv(cov)
    except np.linalg.LinAlgError:
        return np.linalg.pinv(cov)


# ─────────────────────────── показатели портфеля ───────────────────────────
def portfolio_perf(w: np.ndarray, mu: np.ndarray, cov: np.ndarray, rf: float = 0.0) -> dict:
    w = np.asarray(w, dtype=float).ravel()
    ret = float(w @ mu)
    var = float(w @ cov @ w)
    vol = float(np.sqrt(max(var, 0.0)))
    sharpe = (ret - rf) / vol if vol > 0 else 0.0
    return {"ret": ret, "risk": vol, "sharpe": float(sharpe), "weights": [float(x) for x in w]}


# ─────────────────────────── веса ───────────────────────────
def min_variance_weights(cov: np.ndarray, *, long_only: bool = True) -> np.ndarray:
    """Глобальный портфель минимальной дисперсии."""
    cov = np.atleast_2d(np.asarray(cov, dtype=float))
    n = cov.shape[0]
    if n == 0:
        return np.array([])
    if n == 1:
        return np.array([1.0])
    if not long_only:
        inv = _inv(cov)
        ones = np.ones(n)
        w = inv @ ones
        s = ones @ inv @ ones
        return w / s if s != 0 else ones / n
    # long-only: квадратичная задача через SLSQP
    return _solve_min_var(cov, target=None)


def tangency_weights(
    mu: np.ndarray, cov: np.ndarray, rf: float = 0.0, *, long_only: bool = True
) -> np.ndarray:
    """Касательный (max-Sharpe) портфель."""
    mu = np.asarray(mu, dtype=float).ravel()
    cov = np.atleast_2d(np.asarray(cov, dtype=float))
    n = mu.shape[0]
    if n == 0:
        return np.array([])
    if n == 1:
        return np.array([1.0])
    if not long_only:
        inv = _inv(cov)
        excess = mu - rf
        w = inv @ excess
        s = np.ones(n) @ inv @ excess
        if s == 0:
            return np.ones(n) / n
        return w / s
    # long-only: максимизируем Sharpe (минимизируем −Sharpe) при Σw=1, w≥0
    def neg_sharpe(w: np.ndarray) -> float:
        ret = w @ mu
        vol = np.sqrt(max(w @ cov @ w, 1e-18))
        return -(ret - rf) / vol

    w0 = np.ones(n) / n
    cons = ({"type": "eq", "fun": lambda w: w.sum() - 1.0},)
    bounds = [(0.0, 1.0)] * n
    res = minimize(neg_sharpe, w0, method="SLSQP", bounds=bounds, constraints=cons,
                   options={"maxiter": 500, "ftol": 1e-10})
    return res.x if res.success else w0


def _solve_min_var(cov: np.ndarray, target: float | None, mu: np.ndarray | None = None) -> np.ndarray:
    """Long-only min-variance, опционально при wᵀμ = target."""
    n = cov.shape[0]
    w0 = np.ones(n) / n
    cons = [{"type": "eq", "fun": lambda w: w.sum() - 1.0}]
    if target is not None and mu is not None:
        cons.append({"type": "eq", "fun": lambda w, m=mu, t=target: w @ m - t})
    bounds = [(0.0, 1.0)] * n
    res = minimize(lambda w: w @ cov @ w, w0, method="SLSQP", bounds=bounds,
                   constraints=cons, options={"maxiter": 500, "ftol": 1e-12})
    return res.x if res.success else w0


# ─────────────────────────── эффективная граница ───────────────────────────
@dataclass
class FrontierResult:
    points: list[dict]      # [{risk, ret, weights}] по возрастанию риска
    minvar: dict
    tangency: dict
    assets: list[str]


def efficient_frontier(
    mu: np.ndarray,
    cov: np.ndarray,
    rf: float = 0.0,
    *,
    n_points: int = 40,
    long_only: bool = True,
    labels: list[str] | None = None,
) -> FrontierResult:
    """Эффективная граница: для сетки целевых доходностей решаем min-variance.

    Возвращает точки границы, портфель минимальной дисперсии и касательный.
    """
    mu = np.asarray(mu, dtype=float).ravel()
    cov = np.atleast_2d(np.asarray(cov, dtype=float))
    n = mu.shape[0]
    labels = labels or [f"A{i}" for i in range(n)]

    mv_w = min_variance_weights(cov, long_only=long_only)
    tan_w = tangency_weights(mu, cov, rf, long_only=long_only)
    minvar = portfolio_perf(mv_w, mu, cov, rf)
    tangency = portfolio_perf(tan_w, mu, cov, rf)

    points: list[dict] = []
    if n >= 2:
        mv_ret = minvar["ret"]
        hi = float(mu.max())
        lo = mv_ret if long_only else float(min(mu.min(), mv_ret))
        if hi <= lo:
            hi = lo + abs(lo) * 0.5 + 0.01
        for tgt in np.linspace(lo, hi, n_points):
            if long_only:
                w = _solve_min_var(cov, target=float(tgt), mu=mu)
            else:
                w = _min_var_target_short(mu, cov, float(tgt))
            points.append(portfolio_perf(w, mu, cov, rf))
        points.sort(key=lambda p: p["risk"])

    return FrontierResult(points=points, minvar=minvar, tangency=tangency, assets=labels)


def _min_var_target_short(mu: np.ndarray, cov: np.ndarray, target: float) -> np.ndarray:
    """Закрытая форма min-variance при wᵀμ=target, Σw=1 (короткие разрешены)."""
    inv = _inv(cov)
    ones = np.ones(mu.shape[0])
    a = float(ones @ inv @ ones)
    b = float(ones @ inv @ mu)
    c = float(mu @ inv @ mu)
    d = a * c - b * b
    if abs(d) < 1e-18:
        return ones / mu.shape[0]
    lam = (c - b * target) / d
    gam = (a * target - b) / d
    return lam * (inv @ ones) + gam * (inv @ mu)


# ─────────────────────────── две формы для пары ───────────────────────────
def two_asset_min_var(sigma_a: float, sigma_b: float, rho: float) -> float:
    """Доля актива A в портфеле минимальной дисперсии из двух активов (закрытая форма).

        w_A* = (σ_B² − ρ·σ_A·σ_B) / (σ_A² + σ_B² − 2·ρ·σ_A·σ_B)
    """
    denom = sigma_a**2 + sigma_b**2 - 2.0 * rho * sigma_a * sigma_b
    if abs(denom) < 1e-18:
        return 0.5
    w = (sigma_b**2 - rho * sigma_a * sigma_b) / denom
    return float(w)


def two_asset_max_sharpe(
    mu_a: float, mu_b: float, sigma_a: float, sigma_b: float, rho: float, rf: float
) -> float:
    """Доля актива A в касательном (max-Sharpe) портфеле из двух активов (закрытая форма).

    Источник: Bodie/Kane/Marcus, формула оптимального рискового портфеля из двух активов.
    """
    ea = mu_a - rf
    eb = mu_b - rf
    cov_ab = rho * sigma_a * sigma_b
    num = ea * sigma_b**2 - eb * cov_ab
    den = ea * sigma_b**2 + eb * sigma_a**2 - (ea + eb) * cov_ab
    if abs(den) < 1e-18:
        return 0.5
    return float(num / den)


# ─────────────────────────── hedge ratio ───────────────────────────
def hedge_ratio(r_a: np.ndarray, r_b: np.ndarray) -> dict:
    """OLS hedge ratio h = Cov(r_A, r_B) / Var(r_B).

    Шорт h единиц B на 1 единицу A минимизирует дисперсию хеджированной позиции
    r_A − h·r_B. Возвращает h и достигнутое снижение дисперсии (доля).
    """
    a = np.asarray(r_a, dtype=float).ravel()
    b = np.asarray(r_b, dtype=float).ravel()
    n = min(a.shape[0], b.shape[0])
    a, b = a[:n], b[:n]
    var_b = float(b.var(ddof=1)) if n > 1 else 0.0
    if var_b <= 0 or n < 2:
        return {"h": 0.0, "var_reduction": 0.0, "insufficient_data": n < 2}
    cov_ab = float(np.cov(a, b, ddof=1)[0, 1])
    h = cov_ab / var_b
    var_a = float(a.var(ddof=1))
    var_hedged = float((a - h * b).var(ddof=1))
    reduction = 1.0 - var_hedged / var_a if var_a > 0 else 0.0
    return {"h": float(h), "var_reduction": float(reduction), "insufficient_data": False}


# ─────────────────────────── CML ───────────────────────────
def cml_params(rf: float, tangency_vol: float, tangency_ret: float) -> dict:
    """Линия рынка капитала: из (0, rf) через (σ_tangency, E(r_tangency)).

    E(r) = rf + Sharpe_tangency · σ. Возвращает intercept (rf) и slope (Sharpe).
    """
    slope = (tangency_ret - rf) / tangency_vol if tangency_vol > 0 else 0.0
    return {"intercept": float(rf), "slope": float(slope)}
