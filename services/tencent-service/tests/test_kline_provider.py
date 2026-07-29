import pytest

from app.kline_provider import (
    KlineProviderError,
    build_minute_url,
    parse_minute_payload,
    validate_sz_symbol,
)


def test_accepts_only_shenzhen_prefixes():
    assert validate_sz_symbol("002472") == "sz002472"
    assert validate_sz_symbol("003001") == "sz003001"

    with pytest.raises(ValueError, match="INVALID_SYMBOL"):
        validate_sz_symbol("600519")


def test_parses_and_filters_tencent_minute_payload():
    payload = (
        'kline_minute={"data":{"sz002472":{"m5":['
        '["2026-07-28 10:00:00","34.10","34.20","34.25","34.05","1200"],'
        '["bad","34.20","34.10","33.90","34.00","-1"]]}}}'
    )

    assert parse_minute_payload(payload, "sz002472", "5m", 120) == [
        {
            "time": "2026-07-28T10:00:00+08:00",
            "open": 34.10,
            "close": 34.20,
            "high": 34.25,
            "low": 34.05,
            "volume": 1200.0,
        },
    ]


def test_rejects_unsupported_period_and_limit():
    with pytest.raises(ValueError, match="INVALID_PERIOD"):
        build_minute_url("002472", "2m", 120)

    with pytest.raises(ValueError, match="INVALID_LIMIT"):
        build_minute_url("002472", "5m", 501)


def test_invalid_json_raises_controlled_error():
    with pytest.raises(KlineProviderError, match="UPSTREAM_PARSE_ERROR"):
        parse_minute_payload("kline_minute=not-json", "sz002472", "5m", 120)
