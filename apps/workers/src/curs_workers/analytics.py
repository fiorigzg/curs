"""Пайплайн пересчёта аналитики портфеля.

Считает секции в фиксированном порядке (per_asset → risk → capm → correlation →
pairwise → optimization → monte_carlo) через чистые функции finance_core и пишет
результат в portfolio_metrics (универсально) и pairwise_metrics (попарно).

Данные берутся из analytics_data.build_inputs (выровненные ₽-доходности). Каждая
секция переживает нехватку данных: пишет payload с insufficientData=true вместо
падения. Тайминги и события логируются.
"""
from __future__ import annotations

import time
from itertools import combinations

import numpy as np
import structlog
from curs_api.models import PairwiseMetric, PortfolioMetric, Portfolio
from curs_api.services.analytics_data import AnalyticsInputs, build_inputs
from finance_core import capm as fc_capm
from finance_core import correlation as fc_corr
from finance_core import optimize as fc_opt
from finance_core import risk as fc_risk
from finance_core import mc as fc_mc

log = structlog.get_logger()

SECTIONS = ["per_asset", "risk", "capm", "correlation", "pairwise", "optimization", "monte_carlo"]
TRADING_DAYS = 252
TOP_ROLLING_PAIRS = 3
ROLLING_WINDOW = 60


class _Ctx:
    """Предрасчёт общих величин (один раз на прогон): матрицы, μ/Σ, беты, ряд портфеля."""

    def __init__(self, inputs: AnalyticsInputs):
        self.inp = inputs
        self.ids = inputs.asset_ids
        self.n = len(self.ids)
        if self.n:
            self.R = np.column_stack([np.asarray(inputs.returns[a], float) for a in self.ids])
            self.w = np.array([inputs.weights.get(a, 0.0) for a in self.ids])
        else:
            self.R = np.empty((0, 0))
            self.w = np.array([])
        self.rm = np.asarray(inputs.market_returns, float)
        self.rf = inputs.rf_annual
        self.mu_ann, self.cov_ann = fc_opt.mean_cov([inputs.returns[a] for a in self.ids]) \
            if self.n else (np.array([]), np.empty((0, 0)))
        self.mu_d, self.cov_d = fc_opt.mean_cov([inputs.returns[a] for a in self.ids], annualize=False) \
            if self.n else (np.array([]), np.empty((0, 0)))
        self.port_ret = (self.R @ self.w) if self.n else np.array([])
        # Беты активов к рынку (нужны risk и capm).
        self.betas: dict[str, float | None] = {}
        self.per_asset: dict[str, dict] = {}
        for a in self.ids:
            m = fc_capm.capm_metrics(inputs.returns[a], inputs.market_returns, self.rf)
            self.per_asset[a] = m
            self.betas[a] = m.get("beta")


def _insufficient(note: str) -> dict:
    return {"insufficientData": True, "note": note}


# ─────────────────────────── секции ───────────────────────────
def compute_per_asset(ctx: _Ctx) -> dict:
    inp = ctx.inp
    if ctx.n == 0:
        return _insufficient(inp.note or "нет активов")
    market_ann = fc_capm.annualize_return(float(ctx.rm.mean())) if ctx.rm.size else None
    assets = []
    for a in ctx.ids:
        m = ctx.per_asset[a]
        assets.append({
            "id": a,
            "name": inp.asset_meta.get(a, {}).get("name", a),
            "class": inp.asset_meta.get(a, {}).get("class"),
            "weight": inp.weights.get(a, 0.0),
            "meanDaily": m["mean_daily"],
            "annReturn": m["ann_return"],
            "annVol": m["ann_vol"],
            "beta": m.get("beta"),
            "alpha": m.get("alpha"),
            "r2": m.get("r_squared"),
            "idioVol": m.get("idio_vol"),
            "insufficientData": m.get("insufficient_data", False),
        })
    return {
        "insufficientData": False,
        "marketId": inp.market_id,
        "market": {"annReturn": market_ann, "annVol": fc_capm.annualize_vol(float(ctx.rm.std(ddof=1))) if ctx.rm.size > 1 else None},
        "riskFreeAnnual": ctx.rf,
        "assets": assets,
    }


def compute_risk(ctx: _Ctx, params: dict) -> dict:
    if ctx.n == 0 or ctx.rm.size < 30:
        return _insufficient(ctx.inp.note or "недостаточно данных для риска")
    beta_p = fc_risk.portfolio_beta(ctx.w.tolist(), [ctx.betas[a] for a in ctx.ids])
    shocks = params.get("shocks") or list(fc_risk.DEFAULT_SHOCKS)
    custom = params.get("marketShock")
    if custom is not None and float(custom) not in shocks:
        shocks = sorted(set(shocks) | {float(custom)})
    st = fc_risk.stress_test(beta_p, ctx.port_ret, ctx.rm, shocks=tuple(shocks))
    cw = st["conditional_worst"]
    # Маппинг snake_case (lib) → camelCase (контракт фронта).
    return {
        "insufficientData": False,
        "marketId": ctx.inp.market_id,
        "betaP": st["beta_p"],
        "scenarios": st["scenarios"],
        "conditionalWorst": {
            "portfolioMean": cw.get("portfolio_mean"),
            "marketMean": cw.get("market_mean"),
            "nDays": cw.get("n_days"),
            "insufficientData": cw.get("insufficient_data", False),
        },
        "worstPct": st["worst_pct"],
    }


def compute_capm(ctx: _Ctx) -> dict:
    if ctx.n == 0 or ctx.rm.size < 30:
        return _insufficient(ctx.inp.note or "недостаточно данных для CAPM")
    market_ann = fc_capm.annualize_return(float(ctx.rm.mean()))
    sml_points = []
    for a in ctx.ids:
        m = ctx.per_asset[a]
        if m.get("beta") is None:
            continue
        sml_points.append({"x": m["beta"], "y": m["ann_return"], "label": a})
    sml_line = fc_capm.sml_params(ctx.rf, market_ann)

    # CML: касательный портфель из всех активов.
    tan_w = fc_opt.tangency_weights(ctx.mu_ann, ctx.cov_ann, ctx.rf, long_only=True)
    tan = fc_opt.portfolio_perf(tan_w, ctx.mu_ann, ctx.cov_ann, ctx.rf)
    cml_line = fc_opt.cml_params(ctx.rf, tan["risk"], tan["ret"])
    cml_assets = [
        {"x": ctx.per_asset[a]["ann_vol"], "y": ctx.per_asset[a]["ann_return"], "label": a}
        for a in ctx.ids
    ]
    return {
        "insufficientData": False,
        "marketId": ctx.inp.market_id,
        "riskFreeAnnual": ctx.rf,
        "sml": {"points": sml_points, "line": sml_line,
                "market": {"beta": 1.0, "annReturn": market_ann}},
        "cml": {"line": cml_line, "tangency": tan, "assets": cml_assets},
    }


def compute_correlation(ctx: _Ctx) -> dict:
    if ctx.n < 2:
        return _insufficient("нужно ≥2 актива для корреляции")
    series = [ctx.inp.returns[a] for a in ctx.ids]
    matrix = fc_corr.returns_correlation_matrix(series)
    # Топ-K самых коррелированных пар → скользящая 60-дн. корреляция.
    pairs: list[tuple[str, str, float, int, int]] = []
    for i, j in combinations(range(ctx.n), 2):
        pairs.append((ctx.ids[i], ctx.ids[j], matrix[i][j], i, j))
    pairs.sort(key=lambda p: abs(p[2]), reverse=True)
    rolling = []
    for a, b, _, i, j in pairs[:TOP_ROLLING_PAIRS]:
        vals = fc_corr.rolling_correlation(series[i], series[j], ROLLING_WINDOW)
        if not vals:
            continue
        dates = [d.isoformat() for d in ctx.inp.dates[ROLLING_WINDOW:]][: len(vals)]
        rolling.append({"pair": f"{a}/{b}", "a": a, "b": b, "dates": dates, "values": vals})
    return {"insufficientData": False, "labels": ctx.ids, "matrix": matrix, "rolling": rolling}


def _ann_vol(arr: np.ndarray) -> float:
    return float(arr.std(ddof=1)) * np.sqrt(TRADING_DAYS) if arr.size > 1 else 0.0


def _ann_ret(arr: np.ndarray) -> float:
    return float(arr.mean()) * TRADING_DAYS if arr.size else 0.0


async def compute_pairwise(ctx: _Ctx, portfolio: Portfolio) -> dict:
    """Парная регрессия с контролем рынка + 2-активная оптимизация + hedge ratio.

    Пишет строку pairwise_metrics на каждую упорядоченную пару (a<b) и возвращает
    сводку для таблицы на фронте."""
    if ctx.n < 2 or ctx.rm.size < 30:
        return _insufficient("нужно ≥2 актива и история бенчмарка")
    from finance_core.regression import ols

    summary = []
    idx = {a: i for i, a in enumerate(ctx.ids)}
    for a, b in combinations(sorted(ctx.ids), 2):  # a<b лексикографически
        ra = np.asarray(ctx.inp.returns[a], float)
        rb = np.asarray(ctx.inp.returns[b], float)
        n = min(ra.size, rb.size, ctx.rm.size)
        ra, rb, rmm = ra[:n], rb[:n], ctx.rm[:n]
        # (a) парная регрессия с контролем рынка: r_A = α + βB·r_B + βM·r_M + ε
        reg = ols(ra, np.column_stack([rb, rmm]), add_const=True, param_names=["betaB", "betaM"])
        # (b) 2-активная оптимизация (закрытые формы) — на аннуализированных σ/μ.
        sa, sb = _ann_vol(ra), _ann_vol(rb)
        ma, mb = _ann_ret(ra), _ann_ret(rb)
        rho = float(np.corrcoef(ra, rb)[0, 1]) if n > 1 and sa > 0 and sb > 0 else 0.0
        wa_mv = fc_opt.two_asset_min_var(sa, sb, rho)
        wa_ms = fc_opt.two_asset_max_sharpe(ma, mb, sa, sb, rho, ctx.rf)
        # (c) hedge ratio (на дневных доходностях).
        hedge = fc_opt.hedge_ratio(ra, rb)

        def _perf(wa: float) -> dict:
            wv = np.array([wa, 1 - wa])
            mu = np.array([ma, mb])
            cov = np.array([[sa**2, rho * sa * sb], [rho * sa * sb, sb**2]])
            return fc_opt.portfolio_perf(wv, mu, cov, ctx.rf)

        payload = {
            "assetA": a, "assetB": b,
            "regression": {
                "alpha": reg.params[0], "betaB": reg.params[1], "betaM": reg.params[2],
                "r2": reg.r_squared, "residStd": reg.resid_std,
                "pValues": {"alpha": reg.p_values[0], "betaB": reg.p_values[1], "betaM": reg.p_values[2]},
                "singular": reg.singular,
            },
            "minVar": {"wA": wa_mv, "wB": 1 - wa_mv, **_perf(wa_mv)},
            "maxSharpe": {"wA": wa_ms, "wB": 1 - wa_ms, **_perf(wa_ms)},
            "hedge": {
                "h": hedge["h"],
                "varReduction": hedge["var_reduction"],
                "insufficientData": hedge["insufficient_data"],
            },
            "rho": rho,
        }
        await PairwiseMetric.update_or_create(
            portfolio=portfolio, asset_a_id=a, asset_b_id=b, defaults={"payload": payload}
        )
        summary.append({
            "assetA": a, "assetB": b, "r2": reg.r_squared,
            "maxSharpe": payload["maxSharpe"]["sharpe"],
            "hedgeReduction": hedge["var_reduction"], "rho": rho,
        })
    summary.sort(key=lambda x: x["r2"], reverse=True)
    return {"insufficientData": False, "pairs": summary}


def compute_optimization(ctx: _Ctx) -> dict:
    if ctx.n < 2:
        return _insufficient("нужно ≥2 актива для оптимизации")
    fr = fc_opt.efficient_frontier(ctx.mu_ann, ctx.cov_ann, ctx.rf, n_points=40,
                                   long_only=True, labels=ctx.ids)
    current = fc_opt.portfolio_perf(ctx.w, ctx.mu_ann, ctx.cov_ann, ctx.rf)
    assets = [
        {"x": ctx.per_asset[a]["ann_vol"], "y": ctx.per_asset[a]["ann_return"],
         "label": a, "weight": ctx.inp.weights.get(a, 0.0)}
        for a in ctx.ids
    ]
    best = {ctx.ids[i]: float(w) for i, w in enumerate(fr.tangency["weights"])}
    return {
        "insufficientData": False,
        "frontier": [{"risk": p["risk"], "ret": p["ret"]} for p in fr.points],
        "minvar": fr.minvar,
        "tangency": fr.tangency,
        "current": current,
        "assets": assets,
        "bestCombination": best,
    }


def compute_monte_carlo(ctx: _Ctx, params: dict) -> dict:
    if ctx.n == 0 or ctx.port_ret.size < 30:
        return _insufficient(ctx.inp.note or "недостаточно данных для Monte Carlo")
    horizon = int(params.get("horizon", TRADING_DAYS))
    n_sims = int(params.get("simulations", 10_000))
    start = ctx.inp.start_value or 1.0
    param = fc_mc.monte_carlo_parametric(
        ctx.w, ctx.mu_d, ctx.cov_d, start_value=start, horizon=horizon, n_simulations=n_sims
    )
    boot = fc_mc.monte_carlo_bootstrap(
        ctx.port_ret.tolist(), start_value=start, horizon=horizon, n_simulations=n_sims
    )

    def _ser(res) -> dict:
        return {
            "method": res.method, "startValue": res.start_value, "horizon": res.horizon,
            "nSimulations": res.n_simulations, "terminalMean": res.terminal_mean,
            "terminalMedian": res.terminal_median, "percentilesTerminal": res.percentiles_terminal,
            "var": res.var, "cvar": res.cvar, "probLoss": res.prob_loss,
            "fan": res.fan, "samplePaths": res.sample_paths,
        }
    return {"insufficientData": False, "parametric": _ser(param), "bootstrap": _ser(boot)}


# ─────────────────────────── оркестрация ───────────────────────────
async def _persist(portfolio: Portfolio, key: str, payload: dict) -> None:
    await PortfolioMetric.update_or_create(
        portfolio=portfolio, metric_key=key, defaults={"payload": payload}
    )


async def run_pipeline(portfolio: Portfolio, sections: list[str], params: dict, progress_cb=None):
    """Прогон секций по порядку. progress_cb(progress:int, done_section:str) — колбэк."""
    sections = [s for s in SECTIONS if s in (sections or SECTIONS)]  # сохраняем порядок
    t0 = time.time()
    inputs = await build_inputs(portfolio)
    ctx = _Ctx(inputs)
    log.info("analytics.inputs", portfolio=str(portfolio.id), assets=ctx.n,
             obs=len(inputs.dates), market=inputs.market_id, insufficient=inputs.insufficient)

    total = len(sections)
    for i, key in enumerate(sections):
        st = time.time()
        if key == "per_asset":
            payload = compute_per_asset(ctx)
        elif key == "risk":
            payload = compute_risk(ctx, params)
        elif key == "capm":
            payload = compute_capm(ctx)
        elif key == "correlation":
            payload = compute_correlation(ctx)
        elif key == "pairwise":
            payload = await compute_pairwise(ctx, portfolio)
        elif key == "optimization":
            payload = compute_optimization(ctx)
        elif key == "monte_carlo":
            payload = compute_monte_carlo(ctx, params)
        else:
            continue
        await _persist(portfolio, key, payload)
        log.info("analytics.section", portfolio=str(portfolio.id), section=key,
                 ms=round((time.time() - st) * 1000), insufficient=payload.get("insufficientData"))
        if progress_cb:
            await progress_cb(int((i + 1) / total * 100), key)

    log.info("analytics.done", portfolio=str(portfolio.id), sections=len(sections),
             ms=round((time.time() - t0) * 1000))
