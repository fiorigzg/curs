from tortoise import fields
from tortoise.models import Model


class ModelParams(Model):
    """Параметры финансовых моделей per-user. Используется Stage 5 расчётами."""

    id = fields.UUIDField(pk=True)
    user = fields.OneToOneField(
        "models.User", related_name="model_params", on_delete=fields.CASCADE
    )
    benchmark_ru = fields.CharField(max_length=32, default="IMOEX")
    benchmark_us = fields.CharField(max_length=32, default="SP500")
    benchmark_crypto = fields.CharField(max_length=32, default="BTC")
    beta_window_days = fields.IntField(default=90)
    risk_free_rub = fields.DecimalField(max_digits=10, decimal_places=6, default=0.16)  # CBR key rate
    risk_free_usd = fields.DecimalField(max_digits=10, decimal_places=6, default=0.045)  # UST10Y
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "model_params"
