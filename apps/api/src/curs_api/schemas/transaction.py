from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from curs_api.schemas.common import CamelModel, Money


class _Leg(CamelModel):
    asset: str
    qty: Money


class TxIn(CamelModel):
    type: Literal["in"]
    portfolio: UUID
    d: datetime
    asset: str
    qty: Money = Field(gt=0)


class TxOut(CamelModel):
    type: Literal["out"]
    portfolio: UUID
    d: datetime
    asset: str
    qty: Money = Field(gt=0)


class TxSwap(CamelModel):
    type: Literal["tx"]
    portfolio: UUID
    d: datetime
    from_: _Leg = Field(alias="from")
    to: _Leg

    @model_validator(mode="after")
    def _check(self):
        if self.from_.asset == self.to.asset:
            raise ValueError("from.asset must differ from to.asset")
        if self.from_.qty <= 0 or self.to.qty <= 0:
            raise ValueError("qty must be > 0")
        return self


class TxDiv(CamelModel):
    type: Literal["div"]
    portfolio: UUID
    d: datetime
    source: str
    cash_asset: str = Field(alias="cashAsset")
    qty: Money = Field(gt=0)


# Discriminated union для приёма любой формы
TransactionIn = TxIn | TxOut | TxSwap | TxDiv


class TxRowOut(CamelModel):
    """Полиморфный вывод сделки 1-в-1 с CURS_DATA.TX из data.js."""

    id: UUID
    type: str
    portfolio: UUID
    d: datetime
    # in/out
    asset: str | None = None
    qty: Money | None = None
    # tx
    from_: _Leg | None = Field(default=None, alias="from")
    to: _Leg | None = None
    # div
    source: str | None = None
    cash_asset: str | None = Field(default=None, alias="cashAsset")
