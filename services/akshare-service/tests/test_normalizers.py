import math

import pandas as pd
import pytest

from app.errors import AkshareServiceError
from app.normalizers import normalize_daily_bars, normalize_minute_bars, normalize_quotes


def test_quote_fields_are_mapped_from_chinese_dataframe_columns():
    frame = pd.DataFrame(
        [
            {
                "代码": "002472",
                "名称": "双环传动",
                "最新价": 25.5,
                "昨收": 25.0,
                "今开": 25.2,
                "最高": 26.0,
                "最低": 25.1,
                "涨跌额": 0.5,
                "涨跌幅": 2.0,
                "成交量": 100000,
                "成交额": 2550000,
                "换手率": 1.2,
                "量比": 1.5,
            }
        ]
    )

    quotes = normalize_quotes(frame, ["002472"], received_at="2026-07-14T10:30:00+08:00")

    assert quotes == [
        {
            "code": "002472",
            "name": "双环传动",
            "exchange": "SZSE",
            "price": 25.5,
            "previousClose": 25.0,
            "open": 25.2,
            "high": 26.0,
            "low": 25.1,
            "change": 0.5,
            "changePercent": 2.0,
            "volume": 100000,
            "amount": 2550000,
            "turnoverRate": 1.2,
            "volumeRatio": 1.5,
            "bidPrice": 25.5,
            "askPrice": 25.5,
            "marketTimestamp": "2026-07-14T10:30:00+08:00",
            "receivedAt": "2026-07-14T10:30:00+08:00",
            "status": "delayed",
            "source": "AKShare stock_zh_a_spot_em",
            "isDemo": False,
        }
    ]


def test_missing_optional_quote_fields_become_null():
    frame = pd.DataFrame(
        [{"代码": "002472", "名称": "双环传动", "最新价": 25.5, "最高": 26.0, "最低": 25.1}]
    )

    quote = normalize_quotes(frame, ["002472"], received_at="2026-07-14T10:30:00+08:00")[0]

    assert quote["previousClose"] is None
    assert quote["volumeRatio"] is None


def test_rejects_nan_and_infinity_values():
    frame = pd.DataFrame([{"代码": "002472", "名称": "双环传动", "最新价": math.inf}])

    with pytest.raises(AkshareServiceError) as error:
        normalize_quotes(frame, ["002472"], received_at="2026-07-14T10:30:00+08:00")

    assert error.value.code == "NORMALIZATION_ERROR"


def test_rejects_invalid_ohlc():
    frame = pd.DataFrame(
        [{"代码": "002472", "名称": "双环传动", "最新价": 25.5, "今开": 25.2, "最高": 25.0, "最低": 25.1}]
    )

    with pytest.raises(AkshareServiceError) as error:
        normalize_quotes(frame, ["002472"], received_at="2026-07-14T10:30:00+08:00")

    assert error.value.code == "NORMALIZATION_ERROR"


def test_daily_bars_are_sorted_and_duplicates_removed():
    frame = pd.DataFrame(
        [
            {"日期": "2026-07-12", "开盘": 10, "收盘": 11, "最高": 12, "最低": 9, "成交量": 100, "成交额": 1000, "换手率": 1},
            {"日期": "2026-07-11", "开盘": 9, "收盘": 10, "最高": 10, "最低": 8, "成交量": 90, "成交额": 900, "换手率": 1},
            {"日期": "2026-07-12", "开盘": 10, "收盘": 11, "最高": 12, "最低": 9, "成交量": 100, "成交额": 1000, "换手率": 1},
        ]
    )

    bars = normalize_daily_bars(frame, "002472")

    assert [bar["date"] for bar in bars] == ["2026-07-11", "2026-07-12"]
    assert bars[0]["previousClose"] == 9
    assert bars[1]["previousClose"] == 10


def test_minute_bars_are_sorted_and_duplicates_removed():
    frame = pd.DataFrame(
        [
            {"时间": "2026-07-14 09:31:00", "开盘": 10, "收盘": 11, "最高": 12, "最低": 9, "成交量": 100, "成交额": 1000},
            {"时间": "2026-07-14 09:30:00", "开盘": 9, "收盘": 10, "最高": 10, "最低": 8, "成交量": 90, "成交额": 900},
            {"时间": "2026-07-14 09:31:00", "开盘": 10, "收盘": 11, "最高": 12, "最低": 9, "成交量": 100, "成交额": 1000},
        ]
    )

    bars = normalize_minute_bars(frame, "002472", previous_close=9.8, received_at="2026-07-14T10:30:00+08:00")

    assert [bar["timestamp"] for bar in bars] == [
        "2026-07-14T09:30:00+08:00",
        "2026-07-14T09:31:00+08:00",
    ]
    assert bars[0]["previousClose"] == 9.8
