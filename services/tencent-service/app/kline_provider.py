import json
import math
import re
from datetime import datetime
from typing import TypedDict
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


SHANGHAI = ZoneInfo("Asia/Shanghai")
SZ_CODE_PATTERN = re.compile(r"^(000|001|002|003)\d{3}$")
PERIOD_KEYS = {
    "1m": "m1",
    "5m": "m5",
    "15m": "m15",
    "30m": "m30",
    "60m": "m60",
}
KLINE_URL = "https://web.ifzq.gtimg.cn/appstock/app/kline/get"


class MinuteKline(TypedDict):
    time: str
    open: float
    close: float
    high: float
    low: float
    volume: float


class KlineProviderError(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def validate_sz_symbol(code: str) -> str:
    if not SZ_CODE_PATTERN.fullmatch(code):
        raise ValueError("INVALID_SYMBOL")
    return f"sz{code}"


def build_minute_url(code: str, period: str, limit: int) -> str:
    symbol = validate_sz_symbol(code)
    if period not in PERIOD_KEYS:
        raise ValueError("INVALID_PERIOD")
    if not 1 <= limit <= 500:
        raise ValueError("INVALID_LIMIT")
    query = urlencode({"param": f"{symbol},{period},,,{limit}", "_var": "kline_minute"})
    return f"{KLINE_URL}?{query}"


def fetch_minute_klines(code: str, period: str, limit: int, timeout: int = 10) -> list[MinuteKline]:
    request = Request(build_minute_url(code, period, limit), headers={"User-Agent": "AlphaTerminal/1.0"})
    try:
        with urlopen(request, timeout=timeout) as response:
            payload = response.read().decode("utf-8")
    except Exception as error:
        raise KlineProviderError("UPSTREAM_HTTP_ERROR") from error
    return parse_minute_payload(payload, validate_sz_symbol(code), period, limit)


def parse_minute_payload(payload: str, market_symbol: str, period: str, limit: int) -> list[MinuteKline]:
    if period not in PERIOD_KEYS:
        raise ValueError("INVALID_PERIOD")
    if not 1 <= limit <= 500:
        raise ValueError("INVALID_LIMIT")

    raw_json = _extract_json(payload)
    raw_bars = raw_json.get("data", {}).get(market_symbol, {}).get(PERIOD_KEYS[period])
    if not isinstance(raw_bars, list):
        raise KlineProviderError("UPSTREAM_PARSE_ERROR")

    bars = [bar for item in raw_bars if (bar := _parse_bar(item)) is not None]
    if not bars:
        raise KlineProviderError("UPSTREAM_PARSE_ERROR")
    return sorted(bars, key=lambda item: item["time"])[-limit:]


def _extract_json(payload: str) -> dict[str, object]:
    marker = "kline_minute="
    start = payload.find(marker)
    if start < 0:
        raise KlineProviderError("UPSTREAM_PARSE_ERROR")
    try:
        decoded, _ = json.JSONDecoder().raw_decode(payload[start + len(marker) :].lstrip())
    except json.JSONDecodeError as error:
        raise KlineProviderError("UPSTREAM_PARSE_ERROR") from error
    if not isinstance(decoded, dict):
        raise KlineProviderError("UPSTREAM_PARSE_ERROR")
    return decoded


def _parse_bar(item: object) -> MinuteKline | None:
    if not isinstance(item, list) or len(item) < 6:
        return None
    timestamp = _parse_timestamp(item[0])
    values = [_finite_float(value) for value in item[1:6]]
    if timestamp is None or any(value is None for value in values):
        return None
    open_price, close_price, high_price, low_price, volume = values
    assert open_price is not None and close_price is not None and high_price is not None and low_price is not None and volume is not None
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


def _parse_timestamp(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("/", "-"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=SHANGHAI)
    return parsed.astimezone(SHANGHAI).isoformat()


def _finite_float(value: object) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None
