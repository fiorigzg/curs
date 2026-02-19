from tortoise import fields
from tortoise.models import Model


class Quote(Model):
    """Time-series котировок. Заполняется воркерами (Stage 3) и seed-скриптом."""

    id = fields.BigIntField(pk=True)
    asset = fields.ForeignKeyField(
        "models.Asset", related_name="quotes", on_delete=fields.CASCADE, null=True
    )
    benchmark = fields.ForeignKeyField(
        "models.Benchmark", related_name="quotes", on_delete=fields.CASCADE, null=True
    )
    ts = fields.DatetimeField()
    price = fields.DecimalField(max_digits=32, decimal_places=12)
    source = fields.CharField(max_length=16)  # moex|tinkoff|coingecko|cbr|seed

    class Meta:
        table = "quotes"
        indexes = (
            ("asset_id", "ts"),
            ("benchmark_id", "ts"),
        )
