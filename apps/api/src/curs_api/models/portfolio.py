from tortoise import fields
from tortoise.models import Model


class Portfolio(Model):
    id = fields.UUIDField(pk=True)
    user = fields.ForeignKeyField("models.User", related_name="portfolios", on_delete=fields.CASCADE)
    name = fields.CharField(max_length=255)
    color = fields.CharField(max_length=9, default="#15140F")
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "portfolios"

    def __str__(self) -> str:
        return f"Portfolio({self.name})"
