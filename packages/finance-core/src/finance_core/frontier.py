"""Markowitz efficient frontier через Monte Carlo cloud + upper envelope.

Reference: Markowitz (1952) "Portfolio Selection". Полный аналитический фронтир
требует обратной матрицы ковариаций. На Stage 2 используем простую симуляцию
рандомных весов с допущением фиксированной кросс-корреляции (0.3), как в дизайне.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass


@dataclass
class FrontierPoint:
    risk: float
    ret: float


@dataclass
class FrontierResult:
    cloud: list[FrontierPoint]
    frontier: list[FrontierPoint]
    current: FrontierPoint
    optimal: FrontierPoint  # max Sharpe
    minvar: FrontierPoint


def build_frontier(
    mus: list[float],
    sigmas: list[float],
    *,
    current_risk: float,
    current_ret: float,
    risk_free: float = 0.07,
    rho: float = 0.3,
    n_samples: int = 600,
    seed: int = 99,
) -> FrontierResult:
    """mus[i] — годовая ожидаемая доходность i-го актива; sigmas[i] — годовая σ."""
    n = len(mus)
    if n < 2:
        zero = FrontierPoint(0.0, 0.0)
        return FrontierResult([], [], zero, zero, zero)

    rnd = random.Random(seed)
    cloud: list[FrontierPoint] = []
    for _ in range(n_samples):
        w = [rnd.random() for _ in range(n)]
        s = sum(w) or 1.0
        ww = [x / s for x in w]
        mu = sum(ww[i] * mus[i] for i in range(n))
        sig2 = 0.0
        for i in range(n):
            for j in range(n):
                cor = 1.0 if i == j else rho
                sig2 += ww[i] * ww[j] * sigmas[i] * sigmas[j] * cor
        cloud.append(FrontierPoint(risk=math.sqrt(max(sig2, 0.0)), ret=mu))

    # Upper envelope: бьём cloud по risk-биннам и берём max ret в каждом.
    risks = [p.risk for p in cloud]
    min_r, max_r = min(risks), max(risks)
    bins = 40
    frontier: list[FrontierPoint] = []
    for i in range(bins):
        r0 = min_r + (max_r - min_r) * i / bins
        r1 = min_r + (max_r - min_r) * (i + 1) / bins
        sub = [p for p in cloud if r0 <= p.risk < r1]
        if sub:
            frontier.append(max(sub, key=lambda p: p.ret))
    frontier.sort(key=lambda p: p.risk)
    # Strictly monotonic (отбрасываем точки, где ret падает).
    monotonic: list[FrontierPoint] = []
    for p in frontier:
        if not monotonic or p.ret >= monotonic[-1].ret:
            monotonic.append(p)
    frontier = monotonic

    minvar = min(frontier, key=lambda p: p.risk) if frontier else FrontierPoint(0.0, 0.0)
    optimal = (
        max(frontier, key=lambda p: (p.ret - risk_free) / p.risk if p.risk > 0 else -math.inf)
        if frontier
        else FrontierPoint(0.0, 0.0)
    )
    current = FrontierPoint(risk=current_risk, ret=current_ret)
    return FrontierResult(cloud=cloud, frontier=frontier, current=current, optimal=optimal, minvar=minvar)
