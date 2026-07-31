import asyncio

import app.main as main
from app.daily_history_provider import parse_daily_payload


def test_parses_tencent_daily_history_payload():
    payload = (
        'kline_day={"data":{"sz002472":{"qfqday":['
        '["2026-07-28","34.10","34.20","34.25","34.05","1200"],'
        '["bad","34.20","34.10","33.90","34.00","-1"]]}}}'
    )

    assert parse_daily_payload(payload, "sz002472", 120) == [
        {
            "time": "2026-07-28",
            "open": 34.10,
            "close": 34.20,
            "high": 34.25,
            "low": 34.05,
            "volume": 1200.0,
        },
    ]


def test_history_route_returns_normalized_daily_bars(monkeypatch):
    expected = [
        {
            "time": "2026-07-28",
            "open": 34.10,
            "close": 34.20,
            "high": 34.25,
            "low": 34.05,
            "volume": 1200.0,
        },
    ]
    monkeypatch.setattr(main, "fetch_daily_bars", lambda *_: expected)

    response = asyncio.run(main.get_history("002472", "day", 120))

    assert response["success"] is True
    assert response["symbol"] == "002472"
    assert response["data"] == expected
    assert response["source"] == "tencent"
