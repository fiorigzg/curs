from decimal import Decimal

from fastapi import APIRouter, Depends, Query

from curs_api.deps import get_current_user
from curs_api.models import AssetClass, Portfolio, Transaction, User
from curs_api.schemas.dashboard import ByClass, DashboardOverview
from curs_api.services.valuation import (
    compute_holdings,
    portfolio_series_from_quotes,
    portfolio_totals,
    value_position_in_base,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=DashboardOverview)
async def overview(
    ccy: str = Query(default="RUB", alias="ccy"), user: User = Depends(get_current_user)
) -> DashboardOverview:
    ccy = "USD" if (ccy or "").upper() == "USD" else "RUB"
    portfolios = await Portfolio.filter(user=user)

    total = 0.0
    total_cost = 0.0
    for p in portfolios:
        t = await portfolio_totals(p, ccy)
        total += t["total"]
        total_cost += t["total_cost"]

    # by_class
    by = {AssetClass.TRADFI: Decimal(0), AssetClass.CRYPTO: Decimal(0), AssetClass.FIAT: Decimal(0)}
    for p in portfolios:
        for pos in await compute_holdings(p, ccy):
            by[pos.asset.asset_class] += await value_position_in_base(pos.asset, pos.qty, ccy)

    # Агрегированный ряд по всем портфелям (сумма дневных значений).
    aggregated: dict[str, float] = {}
    for p in portfolios:
        for pt in await portfolio_series_from_quotes(p, days=365, ccy=ccy):
            aggregated[pt["d"]] = aggregated.get(pt["d"], 0.0) + pt["v"]
    series_sorted = sorted(aggregated.items())
    series = [{"d": k, "v": v} for k, v in series_sorted]
    year_pct = ((series[-1]["v"] - series[0]["v"]) / series[0]["v"]) if len(series) >= 2 and series[0]["v"] else 0.0

    # Дата самой первой транзакции вообще (по всем портфелям пользователя).
    first_tx = await Transaction.filter(portfolio__user=user).order_by("d").first()
    first_tx_date = first_tx.d.date().isoformat() if first_tx else None

    pl = total - total_cost
    return DashboardOverview(
        total=total,
        total_cost=total_cost,
        total_pl=pl,
        total_pl_pct=(pl / total_cost) if total_cost > 0 else 0.0,
        year_pct=year_pct,
        series=series,
        first_tx_date=first_tx_date,
        by_class=ByClass(
            tradfi=float(by[AssetClass.TRADFI]),
            crypto=float(by[AssetClass.CRYPTO]),
            fiat=float(by[AssetClass.FIAT]),
        ),
    )
