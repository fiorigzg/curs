from tortoise import fields
from tortoise.models import Model


class AssetPrice(Model):
    """Дневная история цен для риск-аналитики (total return).

    Отдельно от живого тикера ``quotes`` (там интрадей-цены для equity-кривой):
    здесь ровно одна строка на торговый день с ``adj_close`` (скорректированной
    на дивиденды ценой). Если источник отдаёт raw close + дивиденды отдельно —
    ``adj_close`` считается загрузчиком (см. workers/price_history.py).

    Ряд привязан либо к активу (``asset``), либо к бенчмарку (``benchmark``) —
    ровно как в ``quotes``. Бенчмарк хранится в этой же таблице (единообразно).
    """

    id = fields.BigIntField(pk=True)
    asset = fields.ForeignKeyField(
        "models.Asset", related_name="prices", on_delete=fields.CASCADE, null=True
    )
    benchmark = fields.ForeignKeyField(
        "models.Benchmark", related_name="prices", on_delete=fields.CASCADE, null=True
    )
    date = fields.DateField()
    close = fields.DecimalField(max_digits=32, decimal_places=12, null=True)
    adj_close = fields.DecimalField(max_digits=32, decimal_places=12)
    volume = fields.DecimalField(max_digits=32, decimal_places=4, null=True)
    source = fields.CharField(max_length=16)  # tinkoff|cryptocompare|coingecko|cbr|seed
    fetched_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "asset_prices"
        # Идемпотентность загрузки: одна строка на (актив, день) и (бенчмарк, день).
        # В Postgres несколько NULL в UNIQUE не конфликтуют, поэтому два ограничения
        # сосуществуют (для строки актива benchmark_id=NULL и наоборот).
        unique_together = (("asset", "date"), ("benchmark", "date"))
        indexes = (
            ("asset_id", "date"),
            ("benchmark_id", "date"),
        )
