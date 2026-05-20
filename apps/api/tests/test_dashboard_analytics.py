import pytest


@pytest.mark.asyncio
async def test_dashboard_overview_empty(client, auth_headers):
    r = await client.get("/dashboard/overview", headers=auth_headers)
    assert r.status_code == 200
    d = r.json()
    assert d["total"] == 0.0
    assert d["byClass"]["tradfi"] == 0.0


@pytest.mark.asyncio
async def test_layout_default(client, auth_headers):
    r = await client.get("/users/me/analytics-layout", headers=auth_headers)
    assert r.status_code == 200
    assert "kpi-value" in r.json()["widgetIds"]


@pytest.mark.asyncio
async def test_layout_update(client, auth_headers):
    r = await client.put(
        "/users/me/analytics-layout",
        headers=auth_headers,
        json={"widgetIds": ["equity", "structure"]},
    )
    assert r.status_code == 200
    assert r.json()["widgetIds"] == ["equity", "structure"]


@pytest.mark.asyncio
async def test_providers_seeded(client, auth_headers):
    r = await client.get("/users/me/providers", headers=auth_headers)
    assert r.status_code == 200
    kinds = {p["id"] for p in r.json()}
    assert kinds == {"tinkoff", "coingecko"}
