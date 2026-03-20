from typing import Literal

from pydantic import Field

from curs_api.schemas.common import CamelModel


class ProviderOut(CamelModel):
    id: Literal["tinkoff", "coingecko"]
    connected: bool
    # Возвращаем поля в masked-виде: ключи показываем как `***xxxx` (последние 4 символа).
    fields: dict = Field(default_factory=dict)
    last_test_ok: bool | None = None
    last_test_latency_ms: int | None = None


class ProviderUpdate(CamelModel):
    connected: bool
    fields: dict = Field(default_factory=dict)


class ProviderTestResult(CamelModel):
    ok: bool
    latency_ms: int | None = None
    error: str | None = None
