from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Any

import pandas as pd

from .errors import AkshareServiceError


QuoteFetcher = Callable[[], Awaitable[pd.DataFrame]]


@dataclass(frozen=True)
class QuoteStrategyCapability:
  name: str
  function_name: str
  source: str
  data_range: str
  request_shape: str
  is_batch: bool
  max_symbols: int
  note: str


@dataclass
class QuoteStrategyResult:
  frame: pd.DataFrame
  strategy_used: str
  attempted_strategies: list[dict[str, Any]] = field(default_factory=list)
  upstream_error_code: str | None = None
  source: str = ""


QUOTE_STRATEGIES: tuple[QuoteStrategyCapability, ...] = (
  QuoteStrategyCapability(
    name="tencent_spot",
    function_name="qt_gtimg_cn",
    source="腾讯财经 qt.gtimg.cn",
    data_range="沪深A股实时行情",
    request_shape="批量接口",
    is_batch=True,
    max_symbols=20,
    note="实时行情通道：亚秒级响应，支持量比/换手率/买卖盘口。",
  ),
)


def _extract_code(value: object) -> str:
  text = str(value)
  digits = "".join(char for char in text if char.isdigit())
  return digits[-6:] if len(digits) >= 6 else text


def _filter_frame(frame: pd.DataFrame, codes: list[str]) -> pd.DataFrame:
  if frame.empty or "代码" not in frame.columns:
    return frame.iloc[0:0].copy()
  filtered = frame.copy()
  filtered["_alpha_code"] = filtered["代码"].map(_extract_code)
  filtered = filtered[filtered["_alpha_code"].isin(codes)].copy()
  filtered["_alpha_order"] = filtered["_alpha_code"].map({code: index for index, code in enumerate(codes)})
  return filtered.sort_values("_alpha_order").drop(columns=["_alpha_code", "_alpha_order"])


class AkShareQuoteStrategy:
  def __init__(
    self,
    *,
    client=None,
    fetchers: dict[str, QuoteFetcher] | None = None,
    capabilities: tuple[QuoteStrategyCapability, ...] = QUOTE_STRATEGIES,
  ):
    self.capabilities = capabilities
    self.fetchers = fetchers or {}


  async def _fetch_tencent(self, codes: list[str]) -> pd.DataFrame:
    from .multichannel_client import TencentQuoteClient
    return await TencentQuoteClient.get_quotes(codes)

  async def get_quotes(self, codes: list[str]) -> QuoteStrategyResult:
    attempts: list[dict[str, Any]] = []
    last_error_code: str | None = None

    for capability in self.capabilities:
      fetcher = self.fetchers.get(capability.name)
      started = time.perf_counter()
      try:
        if capability.name == "tencent_spot":
          frame = await self._fetch_tencent(codes)
        elif fetcher:
          frame = await fetcher()
        else:
          continue

        filtered = _filter_frame(frame, codes)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        if filtered.empty:
          raise AkshareServiceError("NO_DATA", f"{capability.name} 未返回请求股票的报价数据", 502)
        attempts.append(
          {
            "name": capability.name,
            "functionName": capability.function_name,
            "status": "success",
            "elapsedMs": elapsed_ms,
          }
        )
        return QuoteStrategyResult(
          frame=filtered,
          strategy_used=capability.name,
          attempted_strategies=attempts,
          upstream_error_code=last_error_code,
          source=capability.source,
        )
      except Exception as error:
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        last_error_code = getattr(error, "code", type(error).__name__)
        attempts.append(
          {
            "name": capability.name,
            "functionName": capability.function_name,
            "status": "failed",
            "elapsedMs": elapsed_ms,
            "errorCode": last_error_code,
            "message": str(error)[:160],
          }
        )
        await asyncio.sleep(0)

    raise AkshareServiceError(
      "UPSTREAM_UNAVAILABLE",
      "所有行情通道均不可用",
      502,
      details={
        "strategyUsed": None,
        "attemptedStrategies": attempts,
        "upstreamErrorCode": last_error_code,
        "status": "unavailable",
      },
    )