import pytest


@pytest.mark.asyncio
async def test_create_asset_removed(client, auth_headers):
    # Ручное создание актива убрано — метод POST /assets больше не существует.
    r = await client.post(
        "/assets",
        headers=auth_headers,
        json={"id": "FOO", "name": "Foo", "class": "tradfi", "ccy": "RUB"},
    )
    assert r.status_code == 405


@pytest.mark.asyncio
async def test_search_local_filter(client, auth_headers):
    r = await client.get("/assets/search", headers=auth_headers, params={"q": "sol", "ext": "false"})
    assert r.status_code == 200, r.text
    ids = [a["id"] for a in r.json()]
    assert "SOL" in ids
    # все элементы локального поиска не помечены как importable
    assert all(a["importable"] is False for a in r.json())


@pytest.mark.asyncio
async def test_search_recent_first(client, auth_headers):
    pf = (await client.post("/portfolios", headers=auth_headers, json={"name": "P"})).json()["id"]
    # старая сделка
    await client.post(
        "/transactions",
        headers=auth_headers,
        json={"type": "in", "portfolio": pf, "d": "2026-05-20T12:00:00Z", "asset": "RUB", "qty": 100000},
    )
    # свежая сделка с SBER
    await client.post(
        "/transactions",
        headers=auth_headers,
        json={"type": "tx", "portfolio": pf, "d": "2026-05-24T12:00:00Z",
              "from": {"asset": "RUB", "qty": 30000}, "to": {"asset": "SBER", "qty": 100}},
    )

    r = await client.get("/assets/search", headers=auth_headers, params={"q": "", "ext": "false", "limit": 20})
    assert r.status_code == 200, r.text
    ids = [a["id"] for a in r.json()]
    # недавно использованные присутствуют и стоят раньше неиспользованных (напр. GAZP)
    assert "SBER" in ids and "RUB" in ids
    assert "GAZP" in ids
    assert ids.index("SBER") < ids.index("GAZP")
    assert ids.index("RUB") < ids.index("GAZP")


@pytest.mark.asyncio
async def test_import_existing_is_idempotent(client, auth_headers):
    r = await client.post(
        "/assets/import",
        headers=auth_headers,
        json={"id": "BTC", "name": "Bitcoin", "class": "crypto", "ccy": "USD", "source": "coingecko"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["id"] == "BTC"
    # каталог не задвоился
    lst = (await client.get("/assets", headers=auth_headers)).json()
    assert sum(1 for a in lst if a["id"] == "BTC") == 1
