from __future__ import annotations

from fastapi import APIRouter, Request

from ..errors import AkshareServiceError
from ..freshness import now_iso
from ..models import success_response
from ..normalizers import normalize_daily_bars, normalize_minute_bars
from ..symbol_utils import validate_stock_code

router = APIRouter()

ALLOWED_PERIODS = {"1m", "5m", "15m", "30m", "60m"}


@router.get("/stocks/{code}/minute-bars")
async def minute_bars(
  request: Request,
  code: str,
  period: str = "1m",
  start: str | None = None,
  end: str | None = None,
  limit: int = 120,
):
  validate_stock_code(code)
  if period not in ALLOWED_PERIODS:
    raise AkshareServiceError("INVALID_PERIOD", "period参数无效", 400)
  if limit < 1 or limit > 500:
    raise AkshareServiceError("INVALID_LIMIT", "limit参数无效", 400)
  cache_key = f"minute:{code}:{period}:{start or ''}:{end or ''}:{limit}"

  async def load():
    daily = normalize_daily_bars(await request.app.state.client.get_daily_bars(code), code)
    previous_close = daily[-1]["close"] if daily else None
    frame = await request.app.state.client.get_minute_bars(code, period, start, end)
    return normalize_minute_bars(frame, code, previous_close=previous_close, received_at=now_iso())[-limit:]

  result = await request.app.state.cache.get_or_load(cache_key, request.app.state.settings.minute_cache_seconds, load)
  request.app.state.last_success_at = now_iso()
  data = result.value
  market_timestamp = data[-1]["timestamp"] if data else None
  return success_response(
    data,
    source="AKShare stock_zh_a_hist_min_em",
    market_timestamp=market_timestamp,
    received_at=now_iso(),
    status="stale" if result.is_stale else "delayed",
  )
