from tortoise import fields
from tortoise.models import Model


class Benchmark(Model):
    id = fields.CharField(max_length=32, pk=True)  # IMOEX, SP500, BTC, ...
    name = fields.CharField(max_length=255)
    source = fields.CharField(max_length=16)  # moex|tinkoff|coingecko|manual
    ccy = fields.CharField(max_length=8, default="RUB")
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "benchmarks"
