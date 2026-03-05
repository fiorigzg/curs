"""Корреляции активов.

Reference: Любой учебник по статистике. Pearson r = Cov(X,Y)/(σ_X σ_Y).
Считаем по log-returns — они стационарнее simple для финансовых рядов.
"""
from __future__ import annotations

import math
from collections.abc import Sequence

from finance_core.returns import log_returns


def _corr(a: Sequence[float], b: Sequence[float]) -> float:
    n = min(len(a), len(b))
    if n < 2:
        return 0.0
    ma = sum(a[:n]) / n
    mb = sum(b[:n]) / n
    num = sum((a[i] - ma) * (b[i] - mb) for i in range(n))
    da = math.sqrt(sum((a[i] - ma) ** 2 for i in range(n)))
    db = math.sqrt(sum((b[i] - mb) ** 2 for i in range(n)))
    if da == 0 or db == 0:
        return 0.0
    return num / (da * db)


def correlation_matrix(price_series: list[Sequence[float]]) -> list[list[float]]:
    """price_series: список ценовых рядов, по одному на актив (одинаковая длина)."""
    rets = [log_returns(s) for s in price_series]
    n = len(rets)
    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            matrix[i][j] = 1.0 if i == j else _corr(rets[i], rets[j])
    return matrix


def top_pairs(
    labels: list[str], matrix: list[list[float]], k: int = 3
) -> tuple[list[tuple[str, str, float]], list[tuple[str, str, float]]]:
    """Возвращает (топ-k наиболее связанных, топ-k наименее связанных)."""
    pairs: list[tuple[str, str, float]] = []
    for i in range(len(labels)):
        for j in range(i + 1, len(labels)):
            pairs.append((labels[i], labels[j], matrix[i][j]))
    pairs_sorted = sorted(pairs, key=lambda x: x[2], reverse=True)
    return pairs_sorted[:k], pairs_sorted[-k:][::-1]


# ─────────────────────────── на доходностях (Stage 5) ───────────────────────────
def returns_correlation_matrix(returns_list: list[Sequence[float]]) -> list[list[float]]:
    """N×N матрица корреляции Пирсона ГОТОВЫХ дневных доходностей (не цен).

    В отличие от correlation_matrix (берёт цены и сама считает log-returns), здесь
    на вход подаются уже посчитанные доходности (см. analytics). Ряды усекаются до
    общей длины.
    """
    import numpy as np

    arrs = [np.asarray(r, dtype=float).ravel() for r in returns_list]
    if len(arrs) < 2:
        n = len(arrs)
        return [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]
    t = min(a.shape[0] for a in arrs)
    if t < 2:
        n = len(arrs)
        return [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]
    mat = np.corrcoef(np.column_stack([a[:t] for a in arrs]), rowvar=False)
    mat = np.nan_to_num(np.atleast_2d(mat), nan=0.0)
    np.fill_diagonal(mat, 1.0)
    return [[float(v) for v in row] for row in mat]


def rolling_correlation(
    r_a: Sequence[float], r_b: Sequence[float], window: int = 60
) -> list[float]:
    """Скользящая оконная корреляция двух рядов доходностей. Длина = len − window + 1."""
    import numpy as np

    a = np.asarray(r_a, dtype=float).ravel()
    b = np.asarray(r_b, dtype=float).ravel()
    n = min(a.shape[0], b.shape[0])
    a, b = a[:n], b[:n]
    if n < window:
        return []
    out: list[float] = []
    for i in range(n - window + 1):
        wa, wb = a[i : i + window], b[i : i + window]
        sa, sb = wa.std(), wb.std()
        if sa == 0 or sb == 0:
            out.append(0.0)
        else:
            out.append(float(np.corrcoef(wa, wb)[0, 1]))
    return out
