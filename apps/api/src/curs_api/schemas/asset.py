from pydantic import Field

from curs_api.schemas.common import CamelModel, Money


class AssetOut(CamelModel):
    id: str
    name: str
    asset_class: str = Field(alias="class")
    subclass: str | None = None
    sub: str | None = None
    ccy: str
    icon: str
    price: Money | None = None

    @classmethod
    def from_model(cls, asset) -> "AssetOut":
        return cls(
            id=asset.id,
            name=asset.name,
            asset_class=str(asset.asset_class),
            subclass=asset.subclass,
            sub=asset.subclass,
            ccy=asset.ccy,
            icon=asset.icon,
            price=float(asset.current_price) if asset.current_price is not None else None,
        )


class AssetSearchOut(AssetOut):
    """Элемент поиска: локальный актив или внешний кандидат на импорт."""

    importable: bool = False
    source: str | None = None


class AssetImport(CamelModel):
    """Кандидат из внешнего поиска для материализации в каталог."""

    id: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=255)
    asset_class: str = Field(alias="class")
    subclass: str | None = None
    ccy: str = "RUB"
    source: str | None = None
    figi: str | None = None
    coingecko_id: str | None = Field(default=None, alias="coingeckoId")


class AssetQuote(CamelModel):
    asset_id: str
    price: Money | None = None
    ccy: str
    ts: str | None = None
