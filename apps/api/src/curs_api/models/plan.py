from enum import StrEnum

from tortoise import fields
from tortoise.models import Model


class PlanType(StrEnum):
    BUY = "buy"
    SELL = "sell"
    TX = "tx"
    IN = "in"
    OUT = "out"
    DIV = "div"


class TransactionPlan(Model):
    id = fields.UUIDField(pk=True)
    user = fields.ForeignKeyField("models.User", related_name="plans", on_delete=fields.CASCADE)
    portfolio = fields.ForeignKeyField(
        "models.Portfolio", related_name="plans", on_delete=fields.CASCADE
    )
    type = fields.CharEnumField(PlanType, max_length=8)
    d = fields.DateField()

    # buy/sell поля
    asset = fields.ForeignKeyField(
        "models.Asset", related_name="plans_asset", on_delete=fields.RESTRICT, null=True
    )
    qty = fields.DecimalField(max_digits=32, decimal_places=12, null=True)
    price = fields.DecimalField(max_digits=32, decimal_places=12, null=True)
    cash_asset = fields.ForeignKeyField(
        "models.Asset", related_name="plans_cash", on_delete=fields.RESTRICT, null=True
    )

    # tx поля
    from_asset = fields.ForeignKeyField(
        "models.Asset", related_name="plans_from", on_delete=fields.RESTRICT, null=True
    )
    from_qty = fields.DecimalField(max_digits=32, decimal_places=12, null=True)
    to_asset = fields.ForeignKeyField(
        "models.Asset", related_name="plans_to", on_delete=fields.RESTRICT, null=True
    )
    to_qty = fields.DecimalField(max_digits=32, decimal_places=12, null=True)

    # div поля
    source_asset = fields.ForeignKeyField(
        "models.Asset", related_name="plans_source", on_delete=fields.RESTRICT, null=True
    )

    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "transaction_plans"
        indexes = (("user_id", "d"),)
