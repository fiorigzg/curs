from enum import StrEnum

from tortoise import fields
from tortoise.models import Model


class ProviderKind(StrEnum):
    TINKOFF = "tinkoff"
    COINGECKO = "coingecko"


class ProviderConnection(Model):
    """Подключение пользователя к внешнему источнику данных.

    fields_enc — JSON, зашифрованный Fernet, содержит provider-specific поля
    (token для tinkoff; apiKey + plan для coingecko).
    """

    id = fields.UUIDField(pk=True)
    user = fields.ForeignKeyField(
        "models.User", related_name="provider_connections", on_delete=fields.CASCADE
    )
    provider = fields.CharEnumField(ProviderKind, max_length=16)
    connected = fields.BooleanField(default=False)
    fields_enc = fields.BinaryField(null=True)
    last_tested_at = fields.DatetimeField(null=True)
    last_test_ok = fields.BooleanField(null=True)
    last_test_latency_ms = fields.IntField(null=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "provider_connections"
        unique_together = (("user", "provider"),)
