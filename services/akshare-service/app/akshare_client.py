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
    validate_stock_code(code)
    if period not in PERIOD_MAP:
      raise AkshareServiceError("CAPABILITY_UNAVAILABLE", "AKShare分钟接口不支持该周期", 501)

    from .multichannel_client import TencentMinuteClient
    return await asyncio.wait_for(
      TencentMinuteClient.get_minute_bars(code),
      timeout=15,
    )