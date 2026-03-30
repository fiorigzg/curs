"""Sanity-проверки финансовых расчётов на синтетических рядах."""
from datetime import datetime

import pytest

from finance_core import correlation, frontier, metrics, montecarlo, monthly_returns, structure


def test_metrics_flat_series_has_zero_vol():
    prices = [100.0] * 252
    m = metrics.all_metrics(prices)
    assert m["vol"] == 0.0
    assert m["max_dd"] == 0.0
    assert m["cagr"] == 0.0


def test_metrics_growth_series_positive_cagr():
    # 50% rise over 251 daily intervals → cagr ≈ 0.5
    prices = [100.0 * (1.5 ** (i / 251)) for i in range(252)]
    m = metrics.all_metrics(prices)
    assert m["cagr"] == pytest.approx(0.5, rel=0.02)


def test_max_drawdown_basic():
    prices = [100.0, 110, 120, 80, 90, 100]
    dd, idx = metrics.max_drawdown(prices)
    # peak 120 → trough 80 → -33%
    assert dd == pytest.approx(-1 / 3, abs=0.01)
    assert idx == 3


def test_treemap_sorts_and_normalizes():
    items = structure.treemap_items([("A", 30.0), ("B", 70.0), ("C", 1.0)])
    assert items[0].label == "B"
    assert items[1].label == "A"
    total = sum(it.share for it in items)
    assert total == pytest.approx(1.0)


def test_correlation_diagonal_is_one():
    s = [
        [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7],
        [2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7],
    ]
    m = correlation.correlation_matrix(s)
    assert m[0][0] == pytest.approx(1.0)
    assert m[1][1] == pytest.approx(1.0)


def test_frontier_returns_points_with_2_assets():
    res = frontier.build_frontier(
        mus=[0.1, 0.2], sigmas=[0.2, 0.3], current_risk=0.25, current_ret=0.15
    )
    assert len(res.cloud) == 600
    assert len(res.frontier) > 0
    assert res.optimal.risk > 0


def test_montecarlo_paths_shape():
    res = montecarlo.run_monte_carlo(
        start_value=100.0, mu=0.10, sigma=0.20, horizon=10, n_simulations=20
    )
    assert len(res.paths) == 20
    assert len(res.paths[0]) == 10
    assert res.start_value == 100.0
    for key in ("p10", "p25", "p50", "p75", "p90"):
        assert len(res.percentiles[key]) == 10


def test_monthly_returns_groups_by_month():
    points = [
        (datetime(2026, 1, 1), 100.0),
        (datetime(2026, 1, 15), 105.0),
        (datetime(2026, 1, 31), 110.0),
        (datetime(2026, 2, 1), 110.0),
        (datetime(2026, 2, 28), 121.0),
    ]
    months = monthly_returns.monthly_returns(points)
    assert len(months) == 2
    assert months[0].year == 2026 and months[0].month == 0
    assert months[0].ret == pytest.approx(0.10)
    assert months[1].year == 2026 and months[1].month == 1
    assert months[1].ret == pytest.approx(0.10)
