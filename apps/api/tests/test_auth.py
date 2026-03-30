import pytest


@pytest.mark.asyncio
async def test_login_returns_tokens(client, user_token):
    user, token = user_token
    r = await client.post(
        "/auth/login",
        json={"email": user.email, "password": "TestPass123!"},
    )
    assert r.status_code == 200
    d = r.json()
    assert d["user"]["email"] == user.email
    assert d["accessToken"] and d["refreshToken"]


@pytest.mark.asyncio
async def test_me_requires_token(client):
    r = await client.get("/auth/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_works_with_token(client, auth_headers, user_token):
    user, _ = user_token
    r = await client.get("/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["email"] == user.email


@pytest.mark.asyncio
async def test_login_invalid_password(client, user_token):
    user, _ = user_token
    r = await client.post(
        "/auth/login", json={"email": user.email, "password": "wrong"}
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_refresh_rotates_tokens(client, user_token):
    user, _ = user_token
    login = await client.post(
        "/auth/login", json={"email": user.email, "password": "TestPass123!"}
    )
    refresh = login.json()["refreshToken"]
    r = await client.post("/auth/refresh", json={"refreshToken": refresh})
    assert r.status_code == 200
    d = r.json()
    assert d["accessToken"] and d["refreshToken"]
