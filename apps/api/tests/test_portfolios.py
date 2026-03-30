import pytest


@pytest.mark.asyncio
async def test_create_and_list_portfolios(client, auth_headers):
    r = await client.post(
        "/portfolios", headers=auth_headers, json={"name": "Main", "color": "#15140F"}
    )
    assert r.status_code == 201, r.text
    pf_id = r.json()["id"]

    r = await client.get("/portfolios", headers=auth_headers)
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()]
    assert pf_id in ids


@pytest.mark.asyncio
async def test_get_portfolio_detail(client, auth_headers):
    r = await client.post("/portfolios", headers=auth_headers, json={"name": "X"})
    pf_id = r.json()["id"]
    r = await client.get(f"/portfolios/{pf_id}", headers=auth_headers)
    assert r.status_code == 200
    d = r.json()
    assert d["name"] == "X"
    assert d["positions"] == []


@pytest.mark.asyncio
async def test_positions_are_from_to_lots_with_lifecycle(client, auth_headers):
    pf = (await client.post("/portfolios", headers=auth_headers, json={"name": "Ledger"})).json()["id"]

    # Пустой портфель — ни позиций, ни денег.
    d = (await client.get(f"/portfolios/{pf}", headers=auth_headers)).json()
    assert d["positions"] == []
    assert d["total"] == 0.0

    # Пополнение фиатом позиции НЕ создаёт (позиция — это пара from→to).
    await client.post(
        "/transactions", headers=auth_headers,
        json={"type": "in", "portfolio": pf, "d": "2026-05-20T12:00:00Z", "asset": "RUB", "qty": 100000},
    )
    d = (await client.get(f"/portfolios/{pf}", headers=auth_headers)).json()
    assert d["positions"] == []

    # Покупка 100 SBER за 30 000 ₽ → открывается позиция RUB→SBER #1.
    await client.post(
        "/transactions", headers=auth_headers,
        json={"type": "tx", "portfolio": pf, "d": "2026-05-22T12:00:00Z",
              "from": {"asset": "RUB", "qty": 30000}, "to": {"asset": "SBER", "qty": 100}},
    )
    d = (await client.get(f"/portfolios/{pf}", headers=auth_headers)).json()
    assert len(d["positions"]) == 1
    p = d["positions"][0]
    assert p["from"]["id"] == "RUB" and p["to"]["id"] == "SBER"
    assert p["seq"] == 1 and p["closed"] is False
    assert p["qty"] == pytest.approx(100)
    assert p["avgPrice"] == pytest.approx(300)   # 30000 / 100
    assert p["costBase"] == pytest.approx(30000)
    assert p["pl"] == pytest.approx(p["valBase"] - 30000)

    # Продаём все 100 SBER обратно в RUB за 35 000 → выход, позиция закрывается.
    await client.post(
        "/transactions", headers=auth_headers,
        json={"type": "tx", "portfolio": pf, "d": "2026-05-23T12:00:00Z",
              "from": {"asset": "SBER", "qty": 100}, "to": {"asset": "RUB", "qty": 35000}},
    )
    d = (await client.get(f"/portfolios/{pf}", headers=auth_headers)).json()
    assert len(d["positions"]) == 1
    p = d["positions"][0]
    assert p["closed"] is True
    assert p["qty"] == pytest.approx(0)
    assert p["realizedPl"] == pytest.approx(5000)   # 35000 − 30000
    assert p["pl"] == pytest.approx(5000)
    assert p["avgClose"] == pytest.approx(350)       # 35000 / 100 — средняя цена выхода

    # Новая покупка SBER открывает НОВУЮ позицию #2 (закрытая не оживает).
    await client.post(
        "/transactions", headers=auth_headers,
        json={"type": "tx", "portfolio": pf, "d": "2026-05-24T12:00:00Z",
              "from": {"asset": "RUB", "qty": 20000}, "to": {"asset": "SBER", "qty": 50}},
    )
    d = (await client.get(f"/portfolios/{pf}", headers=auth_headers)).json()
    assert len(d["positions"]) == 2
    # Открытая #2 — сверху, закрытая #1 — снизу.
    assert d["positions"][0]["seq"] == 2 and d["positions"][0]["closed"] is False
    assert d["positions"][0]["qty"] == pytest.approx(50)
    assert d["positions"][-1]["seq"] == 1 and d["positions"][-1]["closed"] is True


@pytest.mark.asyncio
async def test_buying_draws_down_source_position(client, auth_headers):
    """Вариант 2: покупка B за A списывает A из позиции-источника и переносит базу."""
    pf = (await client.post("/portfolios", headers=auth_headers, json={"name": "Chain"})).json()["id"]
    await client.post(
        "/transactions", headers=auth_headers,
        json={"type": "in", "portfolio": pf, "d": "2026-05-20T12:00:00Z", "asset": "RUB", "qty": 100000},
    )
    # RUB→USDT: открывает позицию USDT (база 60000₽).
    await client.post(
        "/transactions", headers=auth_headers,
        json={"type": "tx", "portfolio": pf, "d": "2026-05-21T12:00:00Z",
              "from": {"asset": "RUB", "qty": 60000}, "to": {"asset": "USDT", "qty": 1000}},
    )
    # USDT→BTC: тратит все 1000 USDT → позиция RUB→USDT опустошается.
    await client.post(
        "/transactions", headers=auth_headers,
        json={"type": "tx", "portfolio": pf, "d": "2026-05-22T12:00:00Z",
              "from": {"asset": "USDT", "qty": 1000}, "to": {"asset": "BTC", "qty": 0.5}},
    )

    d = (await client.get(f"/portfolios/{pf}", headers=auth_headers)).json()
    open_p = [p for p in d["positions"] if not p["closed"]]
    closed_p = [p for p in d["positions"] if p["closed"]]
    # Открыта только USDT→BTC, рублёвая база перенесена (60000), не по рынку.
    assert len(open_p) == 1
    assert open_p[0]["from"]["id"] == "USDT" and open_p[0]["to"]["id"] == "BTC"
    assert open_p[0]["costBase"] == pytest.approx(60000)
    # Источник RUB→USDT закрыт перекладыванием: qty 0, redeployed, без реализованного P&L.
    assert len(closed_p) == 1
    assert closed_p[0]["from"]["id"] == "RUB" and closed_p[0]["to"]["id"] == "USDT"
    assert closed_p[0]["redeployed"] is True
    assert closed_p[0]["qty"] == pytest.approx(0)
    assert closed_p[0]["realizedPl"] == pytest.approx(0)


@pytest.mark.asyncio
async def test_deleting_transaction_updates_positions(client, auth_headers):
    pf = (await client.post("/portfolios", headers=auth_headers, json={"name": "L2"})).json()["id"]
    created = await client.post(
        "/transactions", headers=auth_headers,
        json={"type": "in", "portfolio": pf, "d": "2026-05-20T12:00:00Z", "asset": "RUB", "qty": 50000},
    )
    tx_id = created.json()["id"]
    d = (await client.get(f"/portfolios/{pf}", headers=auth_headers)).json()
    assert d["total"] == pytest.approx(50000)
    # Удаляем сделку → позиция исчезает.
    await client.delete(f"/transactions/{tx_id}", headers=auth_headers)
    d = (await client.get(f"/portfolios/{pf}", headers=auth_headers)).json()
    assert d["positions"] == []
    assert d["total"] == 0.0


@pytest.mark.asyncio
async def test_update_and_delete_portfolio(client, auth_headers):
    r = await client.post("/portfolios", headers=auth_headers, json={"name": "Old"})
    pf_id = r.json()["id"]
    r = await client.put(
        f"/portfolios/{pf_id}", headers=auth_headers, json={"name": "New"}
    )
    assert r.status_code == 200
    assert r.json()["name"] == "New"
    r = await client.delete(f"/portfolios/{pf_id}", headers=auth_headers)
    assert r.status_code == 204
    r = await client.get(f"/portfolios/{pf_id}", headers=auth_headers)
    assert r.status_code == 404
