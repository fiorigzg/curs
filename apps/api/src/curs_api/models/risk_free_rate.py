from enum import StrEnum

from tortoise import fields
from tortoise.models import Model


class RiskFreeRegion(StrEnum):
    RU = "RU"  # ключевая ставка ЦБ РФ
    US = "US"  # US T-bill / UST (см. docs/analytics.md)


class RiskFreeRate(Model):
    """Дневной ряд безрисковой ставки по регионам.

    ``rate_annual`` — годовая ставка в долях (0.16 = 16%). Дневная ставка
    выводится аналитикой как (1 + rate_annual)^(1/252) − 1.

    Источники (см. docs/analytics.md):
      RU → ключевая ставка ЦБ РФ (cbr.key_rate)
      US → 3M T-bill; по умолчанию ModelParams.risk_free_usd (нет интеграции FRED)
    """

    id = fields.BigIntField(pk=True)
    date = fields.DateField()
    region = fields.CharEnumField(RiskFreeRegion, max_length=4)
    rate_annual = fields.DecimalField(max_digits=10, decimal_places=6)
    source = fields.CharField(max_length=16, default="cbr")
    fetched_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "risk_free_rates"
        unique_together = (("date", "region"),)
        indexes = (("region", "date"),)
