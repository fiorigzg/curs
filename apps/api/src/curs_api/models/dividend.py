from tortoise import fields
from tortoise.models import Model


class Dividend(Model):
    id = fields.UUIDField(pk=True)
    asset = fields.ForeignKeyField(
        "models.Asset", related_name="dividends", on_delete=fields.CASCADE
    )
    ex_date = fields.DateField()
    pay_date = fields.DateField()
    amount_per_share = fields.DecimalField(max_digits=24, decimal_places=8)
    ccy = fields.CharField(max_length=8)

    class Meta:
        table = "dividends"
        indexes = (("asset_id", "pay_date"),)
