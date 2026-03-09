from uuid import UUID
from pydantic import Field

from curs_api.schemas.asset import AssetOut
from curs_api.schemas.common import CamelModel, Money, PointTV


class PortfolioCreate(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    color: str = Field(default="#15140F", pattern=r"^#[0-9A-Fa-f]{3,8}$")


class PortfolioUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{3,8}$")


class PortfolioSummary(CamelModel):
    """Краткое представление портфеля для Dashboard и Sidebar."""

    id: UUID
    name: str
    color: str
    positions_count: int
    total: Money
    delta_pct_90d: float
    series_90d: list[PointTV]


class PositionOut(CamelModel):
    """Лотовая позиция: пара from→to с порядковым номером и статусом open/closed."""

    seq: int
    from_asset: AssetOut = Field(alias="from")
    to_asset: AssetOut = Field(alias="to")
    closed: bool
    redeployed: bool  # закрыта перекладыванием в другой актив (а не обратной продажей)
    qty: Money
    avg_price: Money
    avg_close: Money  # средняя цена выхода (₽/ед.); 0 если продаж не было
    val_base: Money
    cost_base: Money  # суммарно вложено (RUB)
    pl: Money  # суммарный P&L (реализованный + нереализованный), ₽
    planned_pl: Money  # P&L, если исполнить запланированные продажи позиции
    asset_pl: Money  # P&L в валюте `from` пары (USDT/₽…)
    unrealized_pl: Money
    realized_pl: Money
    pl_pct: float
    share: float


class TradeMarker(CamelModel):
    """Точка сделки на графике P&L: дата, направление и ноги (для тултипа)."""

    d: str
    kind: str  # "buy" | "sell"
    from_asset: str
    to_asset: str
    from_qty: float
    to_qty: float


class PortfolioDetail(CamelModel):
    id: UUID
    name: str
    color: str
    total: Money
    total_cost: Money
    pl: Money  # суммарный P&L (реализованный + нереализованный), ₽
    unrealized_pl: Money
    realized_pl: Money
    pl_pct: float
    delta_pct_3m: float
    pnl_series: list[PointTV]  # P&L во времени от первой транзакции (alias pnlSeries)
    trade_markers: list[TradeMarker]  # точки покупок/продаж на графике
    positions: list[PositionOut]
