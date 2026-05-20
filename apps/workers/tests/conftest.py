"""Фикстуры тестов воркеров: подключение к запущенной БД (как в apps/api).

Требуется доступная Postgres с применёнными миграциями (Stage 5 в т.ч.).
Тесты используют уникальные id (uuid) и чистят за собой.
"""
from collections.abc import AsyncIterator

import pytest_asyncio
from tortoise import Tortoise

from curs_api.db import TORTOISE_ORM


@pytest_asyncio.fixture
async def db() -> AsyncIterator[None]:
    await Tortoise.init(config=TORTOISE_ORM)
    try:
        yield
    finally:
        await Tortoise.close_connections()
