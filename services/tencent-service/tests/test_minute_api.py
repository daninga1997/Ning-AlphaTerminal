import asyncio

import app.main as main
from app.kline_provider import KlineProviderError


VALID_BAR = {
    "time": "2026-07-28T10:00:00+08:00",
    "open": 34.1,
    "close": 34.2,
    "high": 34.3,
    "low": 34.0,
    "volume": 1200.0,
}


def test_minute_route_returns_normalized_data(monkeypatch):
    monkeypatch.setattr(main, "fetch_minute_klines", lambda *_: [VALID_BAR])

    response = asyncio.run(main.get_minute_kline("002472", "5m", 120))

    assert response["success"] is True
    assert response["symbol"] == "002472"
    assert response["period"] == "5m"
    assert response["data"] == [VALID_BAR]
    assert response["status"] in {"fresh", "delayed", "closed", "stale"}
    assert response["source"] == "tencent"
    assert response["market_timestamp"] == VALID_BAR["time"]


def test_minute_route_hides_upstream_error(monkeypatch):
    def raise_upstream_error(*_args):
        raise KlineProviderError("UPSTREAM_HTTP_ERROR")

    monkeypatch.setattr(main, "fetch_minute_klines", raise_upstream_error)

    response = asyncio.run(main.get_minute_kline("002472", "5m", 120))

    assert response["success"] is False
    assert response["error"]["code"] == "UPSTREAM_UNAVAILABLE"
    assert "Traceback" not in str(response)
    assert "UPSTREAM_HTTP_ERROR" not in str(response)


def test_minute_route_rejects_invalid_parameters():
    response = asyncio.run(main.get_minute_kline("600519", "5m", 120))

    assert response["success"] is False
    assert response["error"]["code"] == "INVALID_PARAMS"


def test_health_includes_minute_timestamps_after_success(monkeypatch):
    monkeypatch.setattr(main, "fetch_minute_klines", lambda *_: [VALID_BAR])

    asyncio.run(main.get_minute_kline("002472", "1m", 1))
    payload = asyncio.run(main.health())

    assert payload["minute_bars_last_success_at"] is not None
    assert "minute_bars_last_failure_at" in payload
