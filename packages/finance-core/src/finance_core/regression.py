"""OLS-регрессия (метод наименьших квадратов) на numpy.

Reference: Greene, "Econometric Analysis"; стандартная линейная модель
    y = Xβ + ε,   β̂ = (XᵀX)⁻¹Xᵀy
с гомоскедастичными стандартными ошибками
    Var(β̂) = σ̂² (XᵀX)⁻¹,   σ̂² = RSS / (n − k).

Используется для:
- CAPM-регрессии актив–рынок (capm.py)
- парной регрессии с контролем рынка (две объясняющих) — pairwise (analytics)

Краевые случаи: при идеальной коллинеарности XᵀX вырождена → используем
псевдообратную (pinv) и помечаем результат флагом ``singular``; p-values тогда
не определены (NaN).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy import stats


@dataclass
class OLSResult:
    params: list[float]        # коэффициенты [const?, β1, β2, ...]
    r_squared: float
    adj_r_squared: float
    resid_std: float           # σ̂ остатков (та же размерность, что y)
    std_errors: list[float]
    t_values: list[float]
    p_values: list[float]
    n_obs: int
    singular: bool = False
    param_names: list[str] = field(default_factory=list)


def ols(
    y: np.ndarray | list[float],
    X: np.ndarray | list[list[float]],
    *,
    add_const: bool = True,
    param_names: list[str] | None = None,
) -> OLSResult:
    """Регрессия y на X. Если add_const — добавляет столбец единиц (intercept) первым.

    X — матрица (n × k) объясняющих переменных (без константы), либо (n,) для одной.
    """
    y_arr = np.asarray(y, dtype=float).ravel()
    X_arr = np.asarray(X, dtype=float)
    if X_arr.ndim == 1:
        X_arr = X_arr.reshape(-1, 1)

    n = y_arr.shape[0]
    if add_const:
        X_arr = np.column_stack([np.ones(n), X_arr])
        names = ["const"] + (param_names or [f"x{i + 1}" for i in range(X_arr.shape[1] - 1)])
    else:
        names = param_names or [f"x{i + 1}" for i in range(X_arr.shape[1])]

    k = X_arr.shape[1]
    xtx = X_arr.T @ X_arr
    singular = False
    try:
        xtx_inv = np.linalg.inv(xtx)
    except np.linalg.LinAlgError:
        xtx_inv = np.linalg.pinv(xtx)
        singular = True

    beta = xtx_inv @ X_arr.T @ y_arr
    resid = y_arr - X_arr @ beta
    rss = float(resid @ resid)
    tss = float(((y_arr - y_arr.mean()) ** 2).sum())
    dof = n - k

    r2 = 1.0 - rss / tss if tss > 0 else 0.0
    adj_r2 = 1.0 - (1.0 - r2) * (n - 1) / dof if dof > 0 else 0.0
    sigma2 = rss / dof if dof > 0 else float("nan")
    resid_std = float(np.sqrt(sigma2)) if dof > 0 else float("nan")

    se = np.sqrt(np.maximum(np.diag(xtx_inv) * sigma2, 0.0)) if dof > 0 else np.full(k, np.nan)
    with np.errstate(divide="ignore", invalid="ignore"):
        tvals = beta / se
    if dof > 0 and not singular:
        pvals = 2.0 * stats.t.sf(np.abs(tvals), df=dof)
    else:
        pvals = np.full(k, float("nan"))

    return OLSResult(
        params=[float(b) for b in beta],
        r_squared=float(r2),
        adj_r_squared=float(adj_r2),
        resid_std=resid_std,
        std_errors=[float(s) for s in se],
        t_values=[float(t) for t in tvals],
        p_values=[float(p) for p in pvals],
        n_obs=int(n),
        singular=singular,
        param_names=names,
    )
