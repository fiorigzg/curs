"""Доходности из ценового ряда.

Reference: Tsay (2010), "Analysis of Financial Time Series", ch. 1.2 —
Log returns r_t = ln(P_t / P_{t-1}) аддитивны по времени; simple returns —
аддитивны по портфелю (взвешенной сумме). По умолчанию используем simple.
"""
from __future__ import annotations

import math
from collections.abc import Sequence


def simple_returns(prices: Sequence[float]) -> list[float]:
    """r_t = P_t / P_{t-1} - 1."""
    if len(prices) < 2:
        return []
    return [prices[i] / prices[i - 1] - 1.0 for i in range(1, len(prices))]


def log_returns(prices: Sequence[float]) -> list[float]:
    """r_t = ln(P_t / P_{t-1})."""
    if len(prices) < 2:
        return []
    return [math.log(prices[i] / prices[i - 1]) for i in range(1, len(prices))]
