from enum import StrEnum

from tortoise import fields
from tortoise.models import Model


class AssetClass(StrEnum):
    TRADFI = "tradfi"
    CRYPTO = "crypto"
    FIAT = "fiat"


class AssetSubclass(StrEnum):
    STOCK = "Акция"
    BOND = "Облигация"
    ETF = "ETF"
    FUND = "Фонд"


class Asset(Model):
    """Каталог активов. id — это тикер (SBER, BTC, OFZ26240, RUB, ...)."""

    id = fields.CharField(max_length=32, pk=True)
    name = fields.CharField(max_length=255)
    asset_class = fields.CharEnumField(AssetClass, max_length=16)
    subclass = fields.CharField(max_length=32, null=True)
    ccy = fields.CharField(max_length=8, default="RUB")
    icon = fields.CharField(max_length=32, default="a-default")
    # Маппинги во внешние источники (для Stage 3 синка).
    tinkoff_figi = fields.CharField(max_length=64, null=True)
    coingecko_id = fields.CharField(max_length=64, null=True)
    # Кеш текущей цены — обновляется воркером. NULL если ещё не синкали.
    current_price = fields.DecimalField(max_digits=24, decimal_places=8, null=True)
    current_price_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "assets"
        indexes = (("asset_class",),)

    def __str__(self) -> str:
        return f"Asset({self.id})"
