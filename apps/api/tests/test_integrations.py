"""Юнит-тесты чистых функций интеграций (без сетевых вызовов)."""
from curs_api.integrations import coingecko, tinkoff


def test_quotation_to_float():
    assert tinkoff._quotation_to_float({"units": "100", "nano": 500000000}) == 100.5
    assert tinkoff._quotation_to_float({"units": "0", "nano": 0}) == 0.0
    assert tinkoff._quotation_to_float(None) == 0.0
    assert tinkoff._quotation_to_float({"units": "-5", "nano": -250000000}) == -5.25


def test_coingecko_ticker_map_known():
    assert coingecko.TICKER_TO_CG_ID["BTC"] == "bitcoin"
    assert coingecko.TICKER_TO_CG_ID["ETH"] == "ethereum"
    assert coingecko.TICKER_TO_CG_ID["SOL"] == "solana"


def test_coingecko_params_includes_key(monkeypatch):
    monkeypatch.setattr(coingecko.settings, "coingecko_api_key", "CG-test")
    p = coingecko._params({"ids": "bitcoin"})
    assert p["ids"] == "bitcoin"
    assert p["x_cg_demo_api_key"] == "CG-test"


def test_coingecko_params_no_key(monkeypatch):
    monkeypatch.setattr(coingecko.settings, "coingecko_api_key", "")
    p = coingecko._params()
    assert "x_cg_demo_api_key" not in p
