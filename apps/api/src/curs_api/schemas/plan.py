from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import Field

from curs_api.schemas.common import CamelModel, Money


class PlanDraft(CamelModel):
    """Полиморфное тело плана. Поля валидируются на сервисе по type."""

    type: Literal["buy", "sell", "tx", "in", "out", "div"]
    portfolio_id: UUID
    d: date

    asset_id: str | None = None
    qty: Money | None = None
    price: Money | None = None
    cash_asset: str | None = None
    from_asset: str | None = None
    from_qty: Money | None = None
    to_asset: str | None = None
    to_qty: Money | None = None
    source: str | None = None


class PlanOut(PlanDraft):
    id: UUID
