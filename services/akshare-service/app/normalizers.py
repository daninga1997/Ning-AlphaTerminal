from __future__ import annotations

import math
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd

from .errors import AkshareServiceError

SHANGHAI = ZoneInfo("Asia/Shanghai")


def _clean_number(value: Any, *, required: bool = False) -> float | int | None:
  if value is None or pd.isna(value):
    if required:
      raise AkshareServiceError("NORMALIZATION_ERROR", "关键行情字段缺失", 502)
    return None
  if isinstance(value, str) and value.strip() in {"", "-", "--"}:
    if required:
      raise AkshareServiceError("NORMALIZATION_ERROR", "关键行情字段缺失", 502)
    return None
  try:
    number = float(value)
  except (TypeError, ValueError) as error:
    raise AkshareServiceError("NORMALIZATION_ERROR", "行情字段无法转换为数字", 502) from error
  if not math.isfinite(number):
    raise AkshareServiceError("NORMALIZATION_ERROR", "行情字段包含NaN或Infinity", 502)
  if number.is_integer():
    return int(number)
  return number


def _required_columns(frame: pd.DataFrame, columns: list[str]):
  missing = [column for column in columns if column not in frame.columns]
  if missing:
    raise AkshareServiceError("NORMALIZATION_ERROR", f"AKShare字段变化，缺少字段：{','.join(missing)}", 502)


def _validate_ohlc(open_price, high, low, close):
  values = [value for value in [open_price, high, low, close] if value is not None]
  if not values:
    return
  if high is not None and any(high < value for value in values):
    raise AkshareServiceError("NORMALIZATION_ERROR", "OHLC逻辑异常：最高价过低", 502)
  if low is not None and any(low > value for value in values):
    raise AkshareServiceError("NORMALIZATION_ERROR", "OHLC逻辑异常：最低价过高", 502)


def _to_shanghai_iso(value: Any) -> str:
  timestamp = pd.to_datetime(value)
  if timestamp.tzinfo is None:
    timestamp = timestamp.tz_localize(SHANGHAI)
  else:
    timestamp = timestamp.tz_convert(SHANGHAI)
  return timestamp.isoformat()


def normalize_quotes(frame: pd.DataFrame, codes: list[str], received_at: str) -> list[dict[str, Any]]:
  if frame.empty:
    raise AkshareServiceError("NO_DATA", "AKShare未返回报价数据", 502)
  _required_columns(frame, ["代码", "名称", "最新价"])
  filtered = frame[frame["代码"].astype(str).isin(codes)].copy()
  if filtered.empty:
    raise AkshareServiceError("NO_DATA", "未找到请求股票的报价数据", 502)

  quotes: list[dict[str, Any]] = []
  for _, row in filtered.iterrows():
    price = _clean_number(row.get("最新价"), required=True)
    previous_close = _clean_number(row.get("昨收"))
    open_price = _clean_number(row.get("今开"))
    high = _clean_number(row.get("最高"))
    low = _clean_number(row.get("最低"))
    _validate_ohlc(open_price, high, low, price)
    quotes.append(
      {
        "code": str(row["代码"]),
        "name": str(row["名称"]),
        "exchange": "SZSE",
        "price": price,
        "previousClose": previous_close,
        "open": open_price,
        "high": high,
        "low": low,
        "change": _clean_number(row.get("涨跌额")),
        "changePercent": _clean_number(row.get("涨跌幅")),
        "volume": _clean_number(row.get("成交量")),
        "amount": _clean_number(row.get("成交额")),
        "turnoverRate": _clean_number(row.get("换手率")),
        "volumeRatio": _clean_number(row.get("量比")),
        "bidPrice": price,
        "askPrice": price,
        "marketTimestamp": received_at,
        "receivedAt": received_at,
        "status": "delayed",
        "source": "AKShare stock_zh_a_spot_em",
        "isDemo": False,
      }
    )
  return sorted(quotes, key=lambda quote: codes.index(quote["code"]))


def normalize_daily_bars(frame: pd.DataFrame, code: str) -> list[dict[str, Any]]:
  if frame.empty:
    raise AkshareServiceError("NO_DATA", "AKShare未返回日线数据", 502)
  _required_columns(frame, ["日期", "开盘", "收盘", "最高", "最低", "成交量", "成交额"])
  frame = frame.drop_duplicates(subset=["日期"]).sort_values("日期")
  bars: list[dict[str, Any]] = []
  previous_close = None
  for _, row in frame.iterrows():
    open_price = _clean_number(row.get("开盘"), required=True)
    close = _clean_number(row.get("收盘"), required=True)
    high = _clean_number(row.get("最高"), required=True)
    low = _clean_number(row.get("最低"), required=True)
    _validate_ohlc(open_price, high, low, close)
    date = str(row["日期"])[:10]
    bars.append(
      {
        "code": code,
        "date": date,
        "open": open_price,
        "high": high,
        "low": low,
        "close": close,
        "previousClose": previous_close if previous_close is not None else open_price,
        "volume": _clean_number(row.get("成交量"), required=True),
        "amount": _clean_number(row.get("成交额"), required=True),
        "turnoverRate": _clean_number(row.get("换手率")) or 0,
        "source": "AKShare stock_zh_a_hist",
        "isDemo": False,
      }
    )
    previous_close = close
  return bars


def normalize_minute_bars(
  frame: pd.DataFrame,
  code: str,
  *,
  previous_close: float | int | None,
  received_at: str,
) -> list[dict[str, Any]]:
  if frame.empty:
    raise AkshareServiceError("NO_DATA", "AKShare未返回分钟数据", 502)
  _required_columns(frame, ["时间", "开盘", "收盘", "最高", "最低", "成交量", "成交额"])
  frame = frame.drop_duplicates(subset=["时间"]).sort_values("时间")
  bars: list[dict[str, Any]] = []
  for _, row in frame.iterrows():
    open_price = _clean_number(row.get("开盘"), required=True)
    close = _clean_number(row.get("收盘"), required=True)
    high = _clean_number(row.get("最高"), required=True)
    low = _clean_number(row.get("最低"), required=True)
    _validate_ohlc(open_price, high, low, close)
    timestamp = _to_shanghai_iso(row["时间"])
    bars.append(
      {
        "code": code,
        "timestamp": timestamp,
        "open": open_price,
        "high": high,
        "low": low,
        "close": close,
        "volume": _clean_number(row.get("成交量"), required=True),
        "amount": _clean_number(row.get("成交额"), required=True),
        "averagePrice": close,
        "previousClose": previous_close,
        "source": "AKShare stock_zh_a_hist_min_em",
        "receivedAt": received_at,
        "status": "delayed",
        "isDemo": False,
        "isReplay": False,
      }
    )
  return bars
