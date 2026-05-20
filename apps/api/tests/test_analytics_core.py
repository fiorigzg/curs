"""Юнит-тесты аналитического движка (Stage 5) на синтетических данных.

Каждая формула проверяется на входе с известным выходом (например, β точно
равна 1.5). Тесты чистые (только finance_core + numpy), БД не нужна.
"""
from datetime import date

import numpy as np
import pytest

from finance_core import capm, correlation, mc, optimize, risk
from finance_core.adjust import adjusted_close_series
from finance_core.regression import ols


# ─────────────────────────── adjust ───────────────────────────
def test_adjusted_close_no_dividends_equals_close():
    dates = [date(2026, 1, i + 1) for i in range(5)]
    closes = [100.0, 101.0, 102.0, 103.0, 104.0]
    assert adjusted_close_series(dates, closes, []) == closes


def test_adjusted_close_last_equals_raw_and_lifts_returns():
    dates = [date(2026, 1, 1), date(2026, 1, 2), date(2026, 1, 3)]
    closes = [100.0, 101.0, 102.0]
    adj = adjusted_close_series(dates, closes, [(date(2026, 1, 3), 2.0)])
    # последняя точка не корректируется
    assert adj[-1] == pytest.approx(102.0)
    # факт корректировки: prev close 101 → factor 1-2/101
    assert adj[1] == pytest.approx(101.0 * (1 - 2 / 101))


# ─────────────────────────── regression ───────────────────────────
def test_ols_exact_line():
    x = np.linspace(0, 10, 50)
    y = 2.0 + 3.0 * x  # точная прямая
    res = ols(y, x, add_const=True)
    assert res.params[0] == pytest.approx(2.0, abs=1e-9)
    assert res.params[1] == pytest.approx(3.0, abs=1e-9)
    assert res.r_squared == pytest.approx(1.0, abs=1e-12)


def test_ols_collinear_flagged():
    x1 = np.linspace(0, 1, 30)
    X = np.column_stack([x1, x1])  # идеальная коллинеарность
    y = 1.0 + 2.0 * x1
    res = ols(y, X, add_const=True)
    assert res.singular is True


# ─────────────────────────── capm ───────────────────────────
def test_capm_beta_exactly_1_5():
    rng = np.random.default_rng(1)
    rm = rng.normal(0.0005, 0.01, 300)
    ri = 0.0003 + 1.5 * rm  # без шума, rf=0 → β=1.5, α_daily=0.0003 точно
    m = capm.capm_metrics(ri, rm, rf_annual=0.0)
    assert m["beta"] == pytest.approx(1.5, abs=1e-9)
    assert m["alpha_daily"] == pytest.approx(0.0003, abs=1e-9)
    assert m["r_squared"] == pytest.approx(1.0, abs=1e-9)
    assert m["insufficient_data"] is False


def test_capm_insufficient_data():
    m = capm.capm_metrics([0.01] * 10, [0.01] * 10)
    assert m["insufficient_data"] is True
    assert m["beta"] is None


def test_capm_zero_market_variance():
    rng = np.random.default_rng(2)
    ri = rng.normal(0, 0.01, 50)
    rm = [0.001] * 50  # нулевая дисперсия рынка
    m = capm.capm_metrics(ri, rm)
    assert m["insufficient_data"] is True
    assert m["beta"] is None


def test_capm_idiosyncratic_vol_positive_with_noise():
    rng = np.random.default_rng(3)
    rm = rng.normal(0, 0.01, 400)
    ri = 1.0 * rm + rng.normal(0, 0.005, 400)
    m = capm.capm_metrics(ri, rm, rf_annual=0.05)
    assert m["idio_vol"] > 0
    assert 0.5 < m["r_squared"] < 1.0


# ─────────────────────────── optimize ───────────────────────────
def test_two_asset_min_var_closed_form():
    # σA=σB, ρ=0 → 50/50
    assert optimize.two_asset_min_var(0.2, 0.2, 0.0) == pytest.approx(0.5)
    # σA=0.1, σB=0.3, ρ=0 → wA = 0.09/0.10 = 0.9
    assert optimize.two_asset_min_var(0.1, 0.3, 0.0) == pytest.approx(0.9)


def test_two_asset_max_sharpe_prefers_higher_excess():
    wa = optimize.two_asset_max_sharpe(0.20, 0.05, 0.2, 0.2, 0.0, 0.0)
    assert wa > 0.5  # A доходнее при равном риске → больший вес


def test_min_variance_long_only_valid_simplex():
    cov = np.array([[0.04, 0.0], [0.0, 0.09]])
    w = optimize.min_variance_weights(cov, long_only=True)
    assert w.sum() == pytest.approx(1.0, abs=1e-6)
    assert (w >= -1e-9).all()
    assert w[0] > w[1]  # меньше дисперсия у A → больше вес


def test_tangency_long_only_simplex_and_concentration():
    mu = np.array([0.20, 0.05])
    cov = np.array([[0.04, 0.0], [0.0, 0.04]])
    w = optimize.tangency_weights(mu, cov, rf=0.0, long_only=True)
    assert w.sum() == pytest.approx(1.0, abs=1e-6)
    assert (w >= -1e-9).all()
    assert w[0] > w[1]


def test_efficient_frontier_monotonic_returns():
    rng = np.random.default_rng(4)
    R = [rng.normal(m, s, 300) for m, s in [(0.0003, 0.01), (0.0006, 0.02), (0.0001, 0.008)]]
    mu, cov = optimize.mean_cov(R)
    fr = optimize.efficient_frontier(mu, cov, rf=0.02, n_points=25, long_only=True, labels=["A", "B", "C"])
    risks = [p["risk"] for p in fr.points]
    assert risks == sorted(risks)  # точки отсортированы по риску
    assert fr.tangency["sharpe"] >= fr.minvar["sharpe"] - 1e-6


def test_hedge_ratio_perfect_hedge():
    rng = np.random.default_rng(5)
    a = rng.normal(0, 0.01, 200)
    res = optimize.hedge_ratio(a, a)  # хеджируем актив им же
    assert res["h"] == pytest.approx(1.0, abs=1e-9)
    assert res["var_reduction"] == pytest.approx(1.0, abs=1e-6)


def test_cml_slope_is_sharpe():
    p = optimize.cml_params(rf=0.05, tangency_vol=0.2, tangency_ret=0.15)
    assert p["intercept"] == pytest.approx(0.05)
    assert p["slope"] == pytest.approx((0.15 - 0.05) / 0.2)


# ─────────────────────────── risk ───────────────────────────
def test_portfolio_beta_weighted_sum():
    assert risk.portfolio_beta([0.5, 0.5], [1.0, 2.0]) == pytest.approx(1.5)
    # None-беты считаются нулевыми
    assert risk.portfolio_beta([0.5, 0.5], [None, 2.0]) == pytest.approx(1.0)


def test_market_shock_linear():
    assert risk.market_shock_linear(1.2, -0.10) == pytest.approx(-0.12)


def test_stress_test_structure_and_conditional():
    rng = np.random.default_rng(6)
    rm = rng.normal(0, 0.012, 300)
    rp = 1.3 * rm + rng.normal(0, 0.004, 300)
    st = risk.stress_test(1.3, rp, rm, shocks=(-0.05, -0.10, -0.20))
    assert len(st["scenarios"]) == 3
    assert st["scenarios"][0]["model"] == pytest.approx(1.3 * -0.05)
    # finance_core возвращает snake_case (Pythonic); пайплайн маппит в camelCase.
    assert st["conditional_worst"]["insufficient_data"] is False
    # худшие рыночные дни → отрицательная средняя доходность портфеля
    assert st["conditional_worst"]["portfolio_mean"] < 0


# ─────────────────────────── monte carlo ───────────────────────────
def test_mc_parametric_shapes_and_var():
    w = np.array([0.6, 0.4])
    mu_d = np.array([0.0004, 0.0002])
    cov_d = np.array([[1e-4, 2e-5], [2e-5, 1.5e-4]])
    res = mc.monte_carlo_parametric(w, mu_d, cov_d, start_value=1_000_000,
                                    horizon=60, n_simulations=3000, seed=7)
    assert len(res.fan["p50"]) == 61  # horizon + 1
    assert res.percentiles_terminal["p5"] <= res.percentiles_terminal["p50"] <= res.percentiles_terminal["p95"]
    assert res.var["var95"] >= 0.0
    assert 0.0 <= res.prob_loss <= 1.0


def test_mc_bootstrap_runs():
    rng = np.random.default_rng(8)
    port = rng.normal(0.0003, 0.01, 250)
    res = mc.monte_carlo_bootstrap(port, start_value=500_000, horizon=40, n_simulations=2000, seed=9)
    assert res.method == "bootstrap"
    assert len(res.fan["p25"]) == 41


def test_mc_clamps_runaway():
    w = np.array([1.0])
    res = mc.monte_carlo_parametric(w, np.array([0.0]), np.array([[1e-4]]),
                                    start_value=1.0, horizon=10_000, n_simulations=10_000_000)
    assert res.n_simulations <= mc.MAX_SIMS
    assert res.horizon <= mc.MAX_HORIZON


# ─────────────────────────── correlation ───────────────────────────
def test_returns_correlation_diagonal_and_perfect():
    rng = np.random.default_rng(10)
    a = rng.normal(0, 0.01, 100)
    m = correlation.returns_correlation_matrix([a, a, -a])
    assert m[0][0] == pytest.approx(1.0)
    assert m[0][1] == pytest.approx(1.0, abs=1e-9)   # идентичные ряды
    assert m[0][2] == pytest.approx(-1.0, abs=1e-9)  # противоположные


def test_rolling_correlation_length():
    rng = np.random.default_rng(11)
    a = rng.normal(0, 0.01, 100)
    b = rng.normal(0, 0.01, 100)
    vals = correlation.rolling_correlation(a, b, window=60)
    assert len(vals) == 41  # 100 - 60 + 1
