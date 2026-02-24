from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict


def _decimal_to_float(v):
    if isinstance(v, Decimal):
        return float(v)
    return v


Money = Annotated[float, BeforeValidator(_decimal_to_float)]


class CamelModel(BaseModel):
    """Base: camelCase aliases for JSON, snake_case in Python."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=lambda s: s.split("_")[0]
        + "".join(p.title() for p in s.split("_")[1:]),
    )


class PointTV(CamelModel):
    """time-value пара для рядов."""

    d: date | datetime
    v: Money
