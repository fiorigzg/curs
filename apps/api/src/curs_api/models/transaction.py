from enum import StrEnum

from tortoise import fields
from tortoise.models import Model


class TransactionType(StrEnum):
    IN = "in"        # пополнение фиатом
    OUT = "out"      # вывод фиата
    TX = "tx"        # своп: один актив за другой (включая покупки/продажи)
    DIV = "div"      # дивиденд: cash от позиции


class Transaction(Model):
    id = fields.UUIDField(pk=True)
    portfolio = fields.ForeignKeyField(
        "models.Portfolio", related_name="transactions", on_delete=fields.CASCADE
    )
    type = fields.CharEnumField(TransactionType, max_length=8)
    d = fields.DatetimeField()
    # Для div и cash-операций
    source_asset = fields.ForeignKeyField(
        "models.Asset", related_name="div_source_txs", on_delete=fields.RESTRICT, null=True
    )
    cash_asset = fields.ForeignKeyField(
        "models.Asset", related_name="cash_txs", on_delete=fields.RESTRICT, null=True
    )
    cash_qty = fields.DecimalField(max_digits=32, decimal_places=12, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "transactions"
        indexes = (("portfolio_id", "d"),)


class TransactionLeg(Model):
    """Для type=tx — две ноги (out + in). Для in/out — одна нога."""

    id = fields.UUIDField(pk=True)
    transaction = fields.ForeignKeyField(
        "models.Transaction", related_name="legs", on_delete=fields.CASCADE
    )
    asset = fields.ForeignKeyField(
        "models.Asset", related_name="legs", on_delete=fields.RESTRICT
    )
    qty = fields.DecimalField(max_digits=32, decimal_places=12)
    side = fields.CharField(max_length=4)  # "in" | "out" относительно портфеля

    class Meta:
        table = "transaction_legs"
