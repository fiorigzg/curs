"""Tortoise bootstrap для воркеров. Переиспользуем конфиг и модели из curs_api."""
from __future__ import annotations

from contextlib import asynccontextmanager

from curs_api.db import TORTOISE_ORM
from tortoise import Tortoise


@asynccontextmanager
async def lifespan_db():
    await Tortoise.init(config=TORTOISE_ORM)
    try:
        yield
    finally:
        await Tortoise.close_connections()
