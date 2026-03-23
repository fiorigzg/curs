from curs_api.schemas.common import CamelModel, Money, PointTV


class ByClass(CamelModel):
    tradfi: Money
    crypto: Money
    fiat: Money


class DashboardOverview(CamelModel):
    total: Money
    total_cost: Money
    total_pl: Money
    total_pl_pct: float
    year_pct: float
    series: list[PointTV]
    first_tx_date: str | None = None  # дата самой первой транзакции (YYYY-MM-DD)
    by_class: ByClass
