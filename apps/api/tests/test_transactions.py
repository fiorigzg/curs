import pytest


@pytest.mark.asyncio
async def test_create_in_tx(client, auth_headers):
    r = await client.post("/portfolios", headers=auth_headers, json={"name": "P"})
    pf = r.json()["id"]
    r = await client.post(
        "/transactions",
        headers=auth_headers,
        json={
            "type": "in",
            "portfolio": pf,
            "d": "2026-05-22T12:00:00Z",
            "asset": "RUB",
            "qty": 100000,
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["type"] == "in"
    assert r.json()["asset"] == "RUB"
    assert r.json()["qty"] == 100000.0


@pytest.mark.asyncio
async def test_create_swap_tx(client, auth_headers):
    r = await client.post("/portfolios", headers=auth_headers, json={"name": "P"})
    pf = r.json()["id"]
    r = await client.post(
        "/transactions",
        headers=auth_headers,
        json={
            "type": "tx",
            "portfolio": pf,
            "d": "2026-05-22T12:00:00Z",
            "from": {"asset": "RUB", "qty": 30000},
            "to": {"asset": "SBER", "qty": 100},
        },
    )
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["type"] == "tx"
    assert d["from"]["asset"] == "RUB"
    assert d["to"]["asset"] == "SBER"
    assert d["to"]["qty"] == 100


@pytest.mark.asyncio
async def test_update_tx_changes_type_keeps_id(client, auth_headers):
    pf = (await client.post("/portfolios", headers=auth_headers, json={"name": "P"})).json()["id"]
    created = await client.post(
        "/transactions",
        headers=auth_headers,
        json={"type": "in", "portfolio": pf, "d": "2026-05-22T12:00:00Z",
              "asset": "RUB", "qty": 100000},
    )
    assert created.status_code == 201, created.text
    tx_id = created.json()["id"]

    # in → tx: меняем тип, ноги пересобираются, id остаётся прежним
    upd = await client.put(
        f"/transactions/{tx_id}",
        headers=auth_headers,
        json={"type": "tx", "portfolio": pf, "d": "2026-05-23T12:00:00Z",
              "from": {"asset": "RUB", "qty": 30000}, "to": {"asset": "SBER", "qty": 100}},
    )
    assert upd.status_code == 200, upd.text
    d = upd.json()
    assert d["id"] == tx_id
    assert d["type"] == "tx"
    assert d["from"]["asset"] == "RUB"
    assert d["to"]["asset"] == "SBER"
    assert d.get("asset") is None

    # в листинге ровно одна сделка (не задвоилась)
    lst = (await client.get(f"/transactions?portfolio={pf}", headers=auth_headers)).json()
    assert len(lst) == 1
    assert lst[0]["id"] == tx_id


@pytest.mark.asyncio
async def test_update_tx_not_found(client, auth_headers):
    pf = (await client.post("/portfolios", headers=auth_headers, json={"name": "P"})).json()["id"]
    r = await client.put(
        "/transactions/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
        json={"type": "in", "portfolio": pf, "d": "2026-05-22T12:00:00Z",
              "asset": "RUB", "qty": 1000},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_list_filter_by_portfolio(client, auth_headers):
    pf1 = (await client.post("/portfolios", headers=auth_headers, json={"name": "P1"})).json()["id"]
    pf2 = (await client.post("/portfolios", headers=auth_headers, json={"name": "P2"})).json()["id"]
    for pf in (pf1, pf2):
        await client.post(
            "/transactions",
            headers=auth_headers,
            json={"type": "in", "portfolio": pf, "d": "2026-05-22T12:00Z",
                  "asset": "RUB", "qty": 1000},
        )
    r = await client.get(f"/transactions?portfolio={pf1}", headers=auth_headers)
    assert r.status_code == 200
    assert all(t["portfolio"] == pf1 for t in r.json())
