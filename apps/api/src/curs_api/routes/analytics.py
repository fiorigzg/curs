from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from curs_api.deps import get_current_user
from curs_api.models import Asset, AssetClass, Portfolio, Quote, User
from curs_api.schemas.common import CamelModel, Money, PointTV
from curs_api.services.valuation import (
    compute_holdings,
    portfolio_series_from_quotes,
    portfolio_totals,
    value_position_in_base,
)
from finance_core import (
    correlation as fc_corr,
    frontier as fc_frontier,
    metrics as fc_metrics,
    montecarlo as fc_mc,
    monthly_returns as fc_monthly,
    structure as fc_structure,
)

router = APIRouter(tags=["analytics"])


RANGE_DAYS = {"1Н": 7, "1М": 31, "3М": 92, "1Г": 365, "Всё": 365}

CcyParam = Query(default="RUB", alias="ccy")


def _norm_ccy(ccy: str) -> str:
    return "USD" if (ccy or "").upper() == "USD" else "RUB"


# ---------- helpers ---------------------------------------------------------


async def _require_portfolio(portfolio_id: UUID, user: User) -> Portfolio:
    p = await Portfolio.get_or_none(id=portfolio_id, user=user)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="portfolio_not_found")
    return p


async def _series_values(portfolio: Portfolio, days: int) -> tuple[list[float], list[str]]:
    pts = await portfolio_series_from_quotes(portfolio, days=days)
    return [pt["v"] for pt in pts], [pt["d"] for pt in pts]


# ---------- schemas ---------------------------------------------------------


class MetricsOut(CamelModel):
    vol: float
    sharpe: float
    sortino: float
    max_dd: float
    ann_ret: float
    cagr: float
    calmar: float


class StructureItemOut(CamelModel):
    label: str
    value: Money
    share: float
    color: str


class ByClassItem(CamelModel):
    asset_class: str = Field(alias="class")
    value: Money
    share: float


class DrawdownOut(CamelModel):
    series: list[PointTV]
    max_dd: float
    max_dd_date: str | None = None


class CorrelationOut(CamelModel):
    labels: list[str]
    matrix: list[list[float]]


class FrontierPointOut(CamelModel):
    risk: float
    ret: float


class FrontierOut(CamelModel):
    cloud: list[FrontierPointOut]
    frontier: list[FrontierPointOut]
    current: FrontierPointOut
    optimal: FrontierPointOut
    minvar: FrontierPointOut


class MonteCarloBody(BaseModel):
    horizon: int = Field(default=252, ge=20, le=2520)
    simulations: int = Field(default=300, ge=10, le=2000)


class MonteCarloOut(CamelModel):
    paths: list[list[float]]
    percentiles: dict[str, list[float]]
    start_value: Money
    target: Money


class MonthCellOut(CamelModel):
    y: int
    m: int
    ret: float


# ---------- endpoints -------------------------------------------------------


@router.get("/portfolios/{portfolio_id}/metrics", response_model=MetricsOut)
async def get_metrics(
    portfolio_id: UUID,
    range_: str = Query(default="1Г", alias="range"),
    user: User = Depends(get_current_user),
) -> MetricsOut:
    p = await _require_portfolio(portfolio_id, user)
    days = RANGE_DAYS.get(range_, 365)
    values, _ = await _series_values(p, days)
    if len(values) < 2:
        return MetricsOut(vol=0.0, sharpe=0.0, sortino=0.0, max_dd=0.0, ann_ret=0.0, cagr=0.0, calmar=0.0)
    m = fc_metrics.all_metrics(values, risk_free=0.07)
    return MetricsOut(**m)


@router.get("/portfolios/{portfolio_id}/series", response_model=list[PointTV])
async def get_series(
    portfolio_id: UUID,
    range_: str = Query(default="1Г", alias="range"),
    ccy: str = CcyParam,
    user: User = Depends(get_current_user),
) -> list[PointTV]:
    p = await _require_portfolio(portfolio_id, user)
    days = RANGE_DAYS.get(range_, 365)
    return await portfolio_series_from_quotes(p, days=days, ccy=_norm_ccy(ccy))


@router.get("/portfolios/{portfolio_id}/structure", response_model=list[StructureItemOut])
async def get_structure(
    portfolio_id: UUID, ccy: str = CcyParam, user: User = Depends(get_current_user)
) -> list[StructureItemOut]:
    p = await _require_portfolio(portfolio_id, user)
    ccy = _norm_ccy(ccy)
    positions = await compute_holdings(p, ccy)
    items: list[tuple[str, float]] = []
    for pos in positions:
        v = await value_position_in_base(pos.asset, pos.qty, ccy)
        items.append((pos.asset.id, float(v)))
    treemap = fc_structure.treemap_items(items)
    return [
        StructureItemOut(label=it.label, value=it.value, share=it.share, color=it.color)
        for it in treemap
    ]


@router.get("/portfolios/{portfolio_id}/by-class", response_model=list[ByClassItem])
async def get_by_class(
    portfolio_id: UUID, ccy: str = CcyParam, user: User = Depends(get_current_user)
) -> list[ByClassItem]:
    p = await _require_portfolio(portfolio_id, user)
    ccy = _norm_ccy(ccy)
    positions = await compute_holdings(p, ccy)
    items: list[tuple[str, float]] = []
    for pos in positions:
        v = await value_position_in_base(pos.asset, pos.qty, ccy)
        items.append((str(pos.asset.asset_class), float(v)))
    agg = fc_structure.by_class(items)
    total = sum(agg.values()) or 1.0
    return [
        ByClassItem(asset_class=k, value=v, share=v / total)
        for k, v in agg.items()
    ]


@router.get("/portfolios/{portfolio_id}/drawdown", response_model=DrawdownOut)
async def get_drawdown(
    portfolio_id: UUID,
    range_: str = Query(default="1Г", alias="range"),
    user: User = Depends(get_current_user),
) -> DrawdownOut:
    p = await _require_portfolio(portfolio_id, user)
    days = RANGE_DAYS.get(range_, 365)
    values, dates = await _series_values(p, days)
    dd_series = fc_metrics.drawdown_series(values)
    max_dd, idx = fc_metrics.max_drawdown(values) if values else (0.0, 0)
    return DrawdownOut(
        series=[{"d": dates[i], "v": dd_series[i]} for i in range(len(dd_series))],
        max_dd=max_dd,
        max_dd_date=dates[idx] if dates else None,
    )


@router.get("/portfolios/{portfolio_id}/correlation", response_model=CorrelationOut)
async def get_correlation(
    portfolio_id: UUID, user: User = Depends(get_current_user)
) -> CorrelationOut:
    p = await _require_portfolio(portfolio_id, user)
    positions = await compute_holdings(p)
    non_fiat = [pos for pos in positions if pos.asset.asset_class != AssetClass.FIAT]
    if len(non_fiat) < 2:
        return CorrelationOut(labels=[], matrix=[])
    since = datetime.now(timezone.utc) - timedelta(days=365)
    price_series: list[list[float]] = []
    labels: list[str] = []
    for pos in non_fiat:
        rows = (
            await Quote.filter(asset=pos.asset, ts__gte=since).order_by("ts").values("price")
        )
        if len(rows) < 30:
            continue
        price_series.append([float(r["price"]) for r in rows])
        labels.append(pos.asset.id)
    if len(price_series) < 2:
        return CorrelationOut(labels=[], matrix=[])
    matrix = fc_corr.correlation_matrix(price_series)
    return CorrelationOut(labels=labels, matrix=matrix)


@router.get("/portfolios/{portfolio_id}/frontier", response_model=FrontierOut)
async def get_frontier(
    portfolio_id: UUID, user: User = Depends(get_current_user)
) -> FrontierOut:
    p = await _require_portfolio(portfolio_id, user)
    positions = await compute_holdings(p)
    non_fiat = [pos for pos in positions if pos.asset.asset_class != AssetClass.FIAT][:6]
    if len(non_fiat) < 2:
        empty = FrontierPointOut(risk=0.0, ret=0.0)
        return FrontierOut(cloud=[], frontier=[], current=empty, optimal=empty, minvar=empty)

    # μ, σ берём из исторического ряда. Если нет — захардкоженные дефолты.
    mus, sigmas = [], []
    for pos in non_fiat:
        rows = (
            await Quote.filter(asset=pos.asset).order_by("ts").values("price")
        )
        prices = [float(r["price"]) for r in rows]
        if len(prices) >= 30:
            mus.append(fc_metrics.cagr(prices))
            sigmas.append(fc_metrics.annualized_volatility(prices))
        else:
            mus.append(0.10)
            sigmas.append(0.20)

    # Текущие метрики портфеля.
    values, _ = await _series_values(p, days=365)
    if len(values) >= 30:
        current_risk = fc_metrics.annualized_volatility(values)
        current_ret = fc_metrics.cagr(values)
    else:
        current_risk = sum(sigmas) / len(sigmas) if sigmas else 0.0
        current_ret = sum(mus) / len(mus) if mus else 0.0

    res = fc_frontier.build_frontier(
        mus, sigmas, current_risk=current_risk, current_ret=current_ret
    )
    return FrontierOut(
        cloud=[FrontierPointOut(risk=p.risk, ret=p.ret) for p in res.cloud],
        frontier=[FrontierPointOut(risk=p.risk, ret=p.ret) for p in res.frontier],
        current=FrontierPointOut(risk=res.current.risk, ret=res.current.ret),
        optimal=FrontierPointOut(risk=res.optimal.risk, ret=res.optimal.ret),
        minvar=FrontierPointOut(risk=res.minvar.risk, ret=res.minvar.ret),
    )


@router.post("/portfolios/{portfolio_id}/montecarlo", response_model=MonteCarloOut)
async def post_montecarlo(
    portfolio_id: UUID,
    body: MonteCarloBody = Body(default_factory=MonteCarloBody),
    user: User = Depends(get_current_user),
) -> MonteCarloOut:
    p = await _require_portfolio(portfolio_id, user)
    values, _ = await _series_values(p, days=365)
    if not values:
        totals = await portfolio_totals(p)
        start = totals["total"] or 1.0
        mu, sigma = 0.10, 0.20
    else:
        start = values[-1]
        mu = fc_metrics.cagr(values)
        sigma = fc_metrics.annualized_volatility(values)
    res = fc_mc.run_monte_carlo(
        start_value=start, mu=mu, sigma=sigma,
        horizon=body.horizon, n_simulations=body.simulations,
    )
    return MonteCarloOut(
        paths=res.paths, percentiles=res.percentiles,
        start_value=res.start_value, target=res.target,
    )


@router.get("/portfolios/{portfolio_id}/monthly-returns", response_model=list[MonthCellOut])
async def get_monthly_returns(
    portfolio_id: UUID, user: User = Depends(get_current_user)
) -> list[MonthCellOut]:
    p = await _require_portfolio(portfolio_id, user)
    pts = await portfolio_series_from_quotes(p, days=365 * 3)
    if not pts:
        return []
    parsed = [(datetime.fromisoformat(pt["d"]), pt["v"]) for pt in pts]
    months = fc_monthly.monthly_returns(parsed)
    return [MonthCellOut(y=mc.year, m=mc.month, ret=mc.ret) for mc in months]
