from __future__ import annotations

import asyncio
from typing import Any

import pandas as pd

from .config import Settings
from .errors import AkshareServiceError, normalize_error
from .symbol_utils import to_akshare_symbol, validate_stock_code

PERIOD_MAP = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "60m": "60",
}


def _date_for_akshare(value: str | None) -> str | None:
  if not value:
    return None
  return value[:10].replace("-", "")


class AkShareClient:
  def __init__(self, settings: Settings):
    self.settings = settings

  async def _run(self, fn, *args, timeout: int | None = None, **kwargs):
    try:
      return await asyncio.wait_for(
        asyncio.to_thread(fn, *args, **kwargs),
        timeout=timeout or self.settings.request_timeout_seconds,
      )
    except Exception as error:
      raise normalize_error(error) from error

  async def _run_with_retry(self, fn, *args, max_retries: int = 2, timeout: int | None = None, **kwargs):
    """带指数退避重试的_run，用于东方财富等不稳定接口"""
    import time as _time
    last_error = None
    for attempt in range(max_retries + 1):
      try:
        return await asyncio.wait_for(
          asyncio.to_thread(fn, *args, **kwargs),
          timeout=timeout or max(self.settings.request_timeout_seconds, 20),
        )
      except Exception as error:
        last_error = error
        if attempt < max_retries:
          wait_seconds = 2 ** attempt + 1
          await asyncio.sleep(wait_seconds)
    raise normalize_error(last_error) from last_error

  async def get_spot_quotes(self, codes: list[str]) -> pd.DataFrame:
    for code in codes:
      validate_stock_code(code)
    frame = await self.get_spot_quotes_em()
    return frame[frame["代码"].astype(str).isin(codes)].copy()

  async def get_spot_quotes_em(self) -> pd.DataFrame:
    import akshare as ak
    return await self._run_with_retry(ak.stock_zh_a_spot_em, max_retries=1, timeout=12)

  async def get_spot_quotes_em_async(self) -> pd.DataFrame:
    import akshare as ak
    return await self._run_with_retry(ak.stock_zh_a_spot_em_async, max_retries=1, timeout=12)

  async def get_spot_quotes_sina(self) -> pd.DataFrame:
    import akshare as ak

    return await self._run(ak.stock_zh_a_spot, timeout=max(self.settings.request_timeout_seconds, 25))

  async def get_daily_bars(
    self,
    code: str,
    start_date: str | None = None,
    end_date: str | None = None,
    adjust: str = "none",
  ) -> pd.DataFrame:
    symbol = to_akshare_symbol(code)
    if adjust not in {"none", "qfq", "hfq"}:
      raise AkshareServiceError("INVALID_ADJUST", "adjust参数无效", 400)
    import akshare as ak

    frame = await self._run(
      ak.stock_zh_a_hist,
      symbol=symbol,
      period="daily",
      start_date=_date_for_akshare(start_date) or "19700101",
      end_date=_date_for_akshare(end_date) or "22220101",
      adjust="" if adjust == "none" else adjust,
    )
    return frame

  async def get_minute_bars(
    self,
    code: str,
    period: str,
    start_time: str | None = None,
    end_time: str | None = None,
  ) -> pd.DataFrame:
    symbol = to_akshare_symbol(code)
    if period not in PERIOD_MAP:
      raise AkshareServiceError("CAPABILITY_UNAVAILABLE", "AKShare分钟接口不支持该周期", 501)
    import akshare as ak

    kwargs: dict[str, Any] = {
      "symbol": symbol,
      "period": PERIOD_MAP[period],
      "adjust": "",
    }
    if start_time:
      kwargs["start_date"] = start_time.replace("T", " ")[:19]
    if end_time:
      kwargs["end_date"] = end_time.replace("T", " ")[:19]
    return await self._run(ak.stock_zh_a_hist_min_em, **kwargs)
