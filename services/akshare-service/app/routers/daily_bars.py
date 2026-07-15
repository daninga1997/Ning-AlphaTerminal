from __future__ import annotations

from fastapi import APIRouter, Request

from ..errors import AkshareServiceError
from ..freshness import now_iso
from ..models import success_response
from ..normalizers import normalize_daily_bars
from ..symbol_utils import validate_stock_code

router = APIRouter()


@router.get("/stocks/{code}/daily-bars")
async def daily_bars(
  request: Request,
  code: str,
  start: str | None = None,
  end: str | None = None,
  adjust: str = "none",
):
  validate_stock_code(code)
  if adjust not in {"none", "qfq", "hfq"}:
    raise AkshareServiceError("INVALID_ADJUST", "adjust参数无效", 400)
  cache_key = f"daily:{code}:{start or ''}:{end or ''}:{adjust}"

  async def load():
    try:
      frame = await request.app.state.client.get_daily_bars(code, start, end, adjust)
      return normalize_daily_bars(frame, code)
    except Exception:
      request.app.state.daily_bars_last_failure_at = now_iso()
      raise

  result = await request.app.state.cache.get_or_load(cache_key, request.app.state.settings.daily_cache_seconds, load)
  request.app.state.last_success_at = now_iso()
  request.app.state.daily_bars_last_success_at = now_iso()
  data = result.value
  market_timestamp = data[-1]["date"] if data else None
  return success_response(
    data,
    source="AKShare stock_zh_a_hist",
    market_timestamp=market_timestamp,
    received_at=now_iso(),
    status="stale" if result.is_stale else "delayed",
  )
