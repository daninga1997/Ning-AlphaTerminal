from __future__ import annotations

import json
import math
import re
from datetime import date
from typing import TypedDict

import requests


DAILY_HISTORY_URL = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
SZ_CODE_PATTERN = re.compile(r"^(000|001|002|003)\d{3}$")


class DailyHistoryError(Exception):
    pass


class DailyBar(TypedDict):
    time: str
    open: float
    close: float
    high: float
    low: float
    volume: float


def fetch_daily_bars(code: str, count: int, timeout: int = 10) -> list[DailyBar]:
    market_symbol = to_market_symbol(code)
    if not 20 <= count <= 500:
        raise ValueError("INVALID_COUNT")

    params = {
        "param": f"{market_symbol},day,,,{count},qfq",
        "_var": "kline_day",
    }
    try:
        response = requests.get(DAILY_HISTORY_URL, params=params, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as error:
        raise DailyHistoryError("UPSTREAM_HTTP_ERROR") from error

    return parse_daily_payload(response.text, market_symbol, count)


def parse_daily_payload(payload: str, market_symbol: str, count: int) -> list[DailyBar]:
    raw_json = extract_json(payload)
    stock_data = raw_json.get("data", {}).get(market_symbol, {})
    if not isinstance(stock_data, dict):
        raise DailyHistoryError("UPSTREAM_PARSE_ERROR")

    raw_bars = stock_data.get("qfqday") or stock_data.get("day")
    if not isinstance(raw_bars, list):
        raise DailyHistoryError("UPSTREAM_PARSE_ERROR")

    bars = [bar for item in raw_bars if (bar := parse_daily_bar(item)) is not None]
    if not bars:
        raise DailyHistoryError("UPSTREAM_PARSE_ERROR")
    return sorted(bars, key=lambda item: item["time"])[-count:]


def to_market_symbol(code: str) -> str:
    normalized = code.strip().lower().removeprefix("sz")
    if not SZ_CODE_PATTERN.fullmatch(normalized):
        raise ValueError("INVALID_SYMBOL")
    return f"sz{normalized}"


def extract_json(payload: str) -> dict[str, object]:
    content = payload.strip()
    if "=" in content and not content.startswith("{"):
        content = content.split("=", 1)[1].strip().rstrip(";")
    try:
        decoded = json.loads(content)
    except json.JSONDecodeError as error:
        raise DailyHistoryError("UPSTREAM_PARSE_ERROR") from error
    if not isinstance(decoded, dict):
        raise DailyHistoryError("UPSTREAM_PARSE_ERROR")
    return decoded


def parse_daily_bar(item: object) -> DailyBar | None:
    if not isinstance(item, list) or len(item) < 6:
        return None
    timestamp = parse_date(item[0])
    values = [finite_float(value) for value in item[1:6]]
    if timestamp is None or any(value is None for value in values):
        return None
    open_price, close_price, high_price, low_price, volume = values
    assert open_price is not None and close_price is not None and high_price is not None and low_price is not None and volume is not None
    if min(open_price, close_price, high_price, low_price) <= 0:
        return None
    if high_price < max(open_price, close_price, low_price) or low_price > min(open_price, close_price, high_price) or volume < 0:
        return None
    return {
        "time": timestamp,
        "open": open_price,
        "close": close_price,
        "high": high_price,
        "low": low_price,
        "volume": volume,
    }


def parse_date(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        return None


def finite_float(value: object) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None
