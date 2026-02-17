from tortoise import fields
from tortoise.models import Model


class Position(Model):
    id = fields.UUIDField(pk=True)
    portfolio = fields.ForeignKeyField(
        "models.Portfolio", related_name="positions", on_delete=fields.CASCADE
    )
    asset = fields.ForeignKeyField(
        "models.Asset", related_name="positions", on_delete=fields.RESTRICT
    )
    qty = fields.DecimalField(max_digits=32, decimal_places=12)
    avg_price = fields.DecimalField(max_digits=32, decimal_places=12)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "positions"
        unique_together = (("portfolio", "asset"),)
