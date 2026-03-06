"""GBM Monte Carlo simulation для прогноза стоимости портфеля.

Reference: Glasserman (2003) "Monte Carlo Methods in Financial Engineering", ch. 3.
S_{t+1} = S_t · (1 + μ/N + σ/√N · z), z ~ N(0,1), N = TRADING_DAYS.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass

TRADING_DAYS = 252


@dataclass
class MonteCarloResult:
    paths: list[list[float]]
    percentiles: dict[str, list[float]]
    start_value: float
    target: float


def _norm(rnd: random.Random) -> float:
    """Box-Muller normal sample."""
    u1 = max(1e-9, rnd.random())
    u2 = rnd.random()
    return math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)


def run_monte_carlo(
    start_value: float,
    mu: float,
    sigma: float,
    *,
    horizon: int,
    n_simulations: int = 300,
    target_growth: float = 0.30,
    seed: int = 42,
) -> MonteCarloResult:
    rnd = random.Random(seed)
    paths: list[list[float]] = []
    for _ in range(n_simulations):
        path = [start_value]
        px = start_value
        for _ in range(1, horizon):
            z = _norm(rnd)
            px = px * (1.0 + mu / TRADING_DAYS + (sigma / math.sqrt(TRADING_DAYS)) * z)
            path.append(px)
        paths.append(path)

    def _pct(col: list[float], p: float) -> float:
        col_sorted = sorted(col)
        idx = max(0, min(len(col_sorted) - 1, int(len(col_sorted) * p)))
        return col_sorted[idx]

    percentiles: dict[str, list[float]] = {"p10": [], "p25": [], "p50": [], "p75": [], "p90": []}
    for t in range(horizon):
        col = [paths[s][t] for s in range(n_simulations)]
        percentiles["p10"].append(_pct(col, 0.10))
        percentiles["p25"].append(_pct(col, 0.25))
        percentiles["p50"].append(_pct(col, 0.50))
        percentiles["p75"].append(_pct(col, 0.75))
        percentiles["p90"].append(_pct(col, 0.90))

    return MonteCarloResult(
        paths=paths,
        percentiles=percentiles,
        start_value=start_value,
        target=start_value * (1.0 + target_growth),
    )
