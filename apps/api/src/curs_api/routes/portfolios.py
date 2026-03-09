from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from curs_api.deps import get_current_user
from curs_api.models import Portfolio, TransactionPlan, User
from curs_api.schemas.asset import AssetOut
from curs_api.schemas.portfolio import (
    PortfolioCreate,
    PortfolioDetail,
    PortfolioSummary,
    PortfolioUpdate,
    PositionOut,
)
from curs_api.services.valuation import (
    compute_positions,
    portfolio_pnl_series,
    portfolio_series_from_quotes,
    portfolio_totals,
    position_lot_view,
    trade_markers,
    value_position_in_base,
)

router = APIRouter(prefix="/portfolios", tags=["portfolios"])

# Валюта отображения (база расчёта). Поддерживаем RUB и USD.
CcyParam = Query(default="RUB", alias="ccy")


def _norm_ccy(ccy: str) -> str:
    return "USD" if (ccy or "").upper() == "USD" else "RUB"


async def _planned_sell_legs(p: Portfolio) -> list[tuple[str, "Decimal", str, "Decimal"]]:
    """Запланированные ПРОДАЖИ как (sold_asset_id, sold_qty, recv_asset_id, recv_qty).
    Только планы-сделки, отдающие актив (tx/sell)."""
    from decimal import Decimal

    plans = await TransactionPlan.filter(portfolio=p)
    legs: list[tuple[str, Decimal, str, Decimal]] = []
    for pl in plans:
        t = str(pl.type)
        if t == "tx" and pl.from_asset_id and pl.to_asset_id and pl.from_qty and pl.to_qty:
            legs.append((pl.from_asset_id, Decimal(pl.from_qty), pl.to_asset_id, Decimal(pl.to_qty)))
        elif t == "sell" and pl.asset_id and pl.cash_asset_id and pl.qty and pl.price:
            legs.append((pl.asset_id, Decimal(pl.qty), pl.cash_asset_id, Decimal(pl.qty) * Decimal(pl.price)))
    return legs


async def _positions_out(p: Portfolio, ccy: str, class_: str | None = None) -> list[PositionOut]:
    """Лотовые позиции (в валюте ccy): открытые сверху (по стоимости), закрытые снизу.

    share — доля от суммарной стоимости позиций (а не от стоимости портфеля,
    т.к. позиции независимы и их стоимости могут «дублировать» один актив).
    planned_pl — P&L, если исполнить запланированные продажи этой пары.
    asset_pl — P&L в валюте `from` пары (USDT-пара → в USD≈USDT, RUB-пара → в ₽)."""
    # Два прохода: ₽ и $. qty/closed/порядок не зависят от валюты, поэтому списки
    # позиций идентичны и зипуются по индексу. Отображение берёт проход ccy,
    # Asset P&L — проход валюты `from` каждой позиции.
    pos_rub = await compute_positions(p, "RUB")
    pos_usd = await compute_positions(p, "USD")
    rub_v = [await position_lot_view(x, "RUB") for x in pos_rub]
    usd_v = [await position_lot_view(x, "USD") for x in pos_usd]
    disp_pos = pos_usd if ccy == "USD" else pos_rub
    disp_v = usd_v if ccy == "USD" else rub_v

    triples = []
    for i, pos in enumerate(disp_pos):
        if class_ and class_ != "all" and str(pos.to_asset.asset_class) != class_:
            continue
        asset_pl = usd_v[i]["pl"] if pos.from_asset.ccy == "USD" else rub_v[i]["pl"]
        triples.append((pos, disp_v[i], asset_pl))

    total_val = sum(v["val_base"] for _, v, _ in triples)
    sell_legs = await _planned_sell_legs(p)

    rows: list[PositionOut] = []
    for pos, v, asset_pl in triples:
        planned_extra = 0.0
        if not pos.closed and sell_legs:
            cur_to = float(await value_position_in_base(pos.to_asset, 1, ccy))
            for sold_id, sold_qty, recv_id, recv_qty in sell_legs:
                if sold_id == pos.to_asset.id and recv_id == pos.from_asset.id:
                    proceeds = float(await value_position_in_base(pos.from_asset, recv_qty, ccy))
                    planned_extra += proceeds - float(sold_qty) * cur_to
        rows.append(
            PositionOut(
                seq=v["seq"],
                from_asset=AssetOut.from_model(v["from_asset"]),
                to_asset=AssetOut.from_model(v["to_asset"]),
                closed=v["closed"], redeployed=v["redeployed"],
                qty=v["qty"], avg_price=v["avg_price"], avg_close=v["avg_close"], val_base=v["val_base"],
                cost_base=v["cost_base"], pl=v["pl"], planned_pl=v["pl"] + planned_extra,
                asset_pl=asset_pl,
                unrealized_pl=v["unrealized_pl"], realized_pl=v["realized_pl"], pl_pct=v["pl_pct"],
                share=(v["val_base"] / total_val) if total_val > 0 else 0.0,
            )
        )
    open_r = sorted((r for r in rows if not r.closed), key=lambda r: r.val_base, reverse=True)
    closed_r = sorted((r for r in rows if r.closed), key=lambda r: r.realized_pl, reverse=True)
    return [*open_r, *closed_r]


async def _open_count(p: Portfolio) -> int:
    return len([pos for pos in await compute_positions(p) if not pos.closed])


@router.get("", response_model=list[PortfolioSummary])
async def list_portfolios(
    ccy: str = CcyParam, user: User = Depends(get_current_user)
) -> list[PortfolioSummary]:
    ccy = _norm_ccy(ccy)
    out = []
    for p in await Portfolio.filter(user=user).order_by("created_at"):
        totals = await portfolio_totals(p, ccy)
        positions_count = await _open_count(p)
        series_90 = await portfolio_series_from_quotes(p, days=90, ccy=ccy)
        start = series_90[0]["v"] if series_90 else totals["total"]
        delta_pct_90 = ((totals["total"] - start) / start) if start else 0.0
        out.append(
            PortfolioSummary(
                id=p.id,
                name=p.name,
                color=p.color,
                positions_count=positions_count,
                total=totals["total"],
                delta_pct_90d=delta_pct_90,
                series_90d=series_90,
            )
        )
    return out


@router.post("", response_model=PortfolioSummary, status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    body: PortfolioCreate, user: User = Depends(get_current_user)
) -> PortfolioSummary:
    p = await Portfolio.create(user=user, name=body.name, color=body.color)
    return PortfolioSummary(
        id=p.id, name=p.name, color=p.color,
        positions_count=0, total=0.0, delta_pct_90d=0.0, series_90d=[],
    )


@router.get("/{portfolio_id}", response_model=PortfolioDetail)
async def get_portfolio(
    portfolio_id: UUID, ccy: str = CcyParam, user: User = Depends(get_current_user)
) -> PortfolioDetail:
    p = await _require_portfolio(portfolio_id, user)
    ccy = _norm_ccy(ccy)
    totals = await portfolio_totals(p, ccy)
    # Стоимостный ряд (3М) — только для % изменения стоимости в шапке.
    val_3m = await portfolio_series_from_quotes(p, days=92, ccy=ccy)
    start = val_3m[0]["v"] if val_3m else totals["total"]
    delta_pct_3m = ((totals["total"] - start) / start) if start else 0.0
    # P&L во времени — от создания портфеля (первой транзакции) до сегодня.
    pnl_series = await portfolio_pnl_series(p, ccy=ccy)
    return PortfolioDetail(
        id=p.id, name=p.name, color=p.color,
        total=totals["total"], total_cost=totals["total_cost"],
        pl=totals["pl"], unrealized_pl=totals["unrealized_pl"],
        realized_pl=totals["realized_pl"], pl_pct=totals["pl_pct"],
        delta_pct_3m=delta_pct_3m, pnl_series=pnl_series,
        trade_markers=await trade_markers(p),
        positions=await _positions_out(p, ccy),
    )


@router.put("/{portfolio_id}", response_model=PortfolioSummary)
async def update_portfolio(
    portfolio_id: UUID, body: PortfolioUpdate, user: User = Depends(get_current_user)
) -> PortfolioSummary:
    p = await _require_portfolio(portfolio_id, user)
    if body.name is not None:
        p.name = body.name
    if body.color is not None:
        p.color = body.color
    await p.save()
    totals = await portfolio_totals(p)
    positions_count = await _open_count(p)
    return PortfolioSummary(
        id=p.id, name=p.name, color=p.color,
        positions_count=positions_count, total=totals["total"],
        delta_pct_90d=0.0, series_90d=[],
    )  # totals здесь RUB — сразу после сохранения сводка обновится отдельным GET


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio(
    portfolio_id: UUID, user: User = Depends(get_current_user)
) -> None:
    p = await _require_portfolio(portfolio_id, user)
    await p.delete()


@router.get("/{portfolio_id}/positions", response_model=list[PositionOut])
async def list_positions(
    portfolio_id: UUID,
    class_: str | None = Query(default=None, alias="class"),
    ccy: str = CcyParam,
    user: User = Depends(get_current_user),
) -> list[PositionOut]:
    p = await _require_portfolio(portfolio_id, user)
    return await _positions_out(p, _norm_ccy(ccy), class_)


async def _require_portfolio(portfolio_id: UUID, user: User) -> Portfolio:
    p = await Portfolio.get_or_none(id=portfolio_id, user=user)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="portfolio_not_found")
    return p
