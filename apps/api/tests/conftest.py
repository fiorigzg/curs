"""Pytest fixtures: ASGI клиент с привязкой к запущенной БД.

Тесты идемпотентны: используют отдельного юзера с email-постфиксом из uuid,
данные не пересекаются между прогонами и не требуют чистой БД.
"""
import uuid
from collections.abc import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport
from tortoise import Tortoise

from curs_api.auth.password import hash_password
from curs_api.db import TORTOISE_ORM
from curs_api.main import app
from curs_api.models import User


@pytest_asyncio.fixture
async def _db():
    await Tortoise.init(config=TORTOISE_ORM)
    yield
    await Tortoise.close_connections()


@pytest_asyncio.fixture
async def client(_db) -> AsyncIterator[httpx.AsyncClient]:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def user_token(_db, client: httpx.AsyncClient) -> tuple[User, str]:
    email = f"u{uuid.uuid4().hex[:10]}@test.local"
    pw = "TestPass123!"
    user = await User.create(
        email=email, password_hash=hash_password(pw), display_name="t"
    )
    r = await client.post("/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return user, r.json()["accessToken"]


@pytest.fixture
def auth_headers(user_token: tuple[User, str]) -> dict:
    _, token = user_token
    return {"Authorization": f"Bearer {token}"}
