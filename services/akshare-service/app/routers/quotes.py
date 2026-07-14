from __future__ import annotations

from fastapi import APIRouter, Request

from ..errors import AkshareServiceError
from ..freshness import now_iso
from ..models import success_response
from ..normalizers import normalize_quotes
from ..symbol_utils import validate_stock_code

router = APIRouter()


def parse_codes(raw_codes: str | None, max_symbols: int) -> list[str]:
  if not raw_codes:
    raise AkshareServiceError("MISSING_CODES", "缺少codes参数", 400)
  codes = [code.strip() for code in raw_codes.split(",") if code.strip()]
  if not codes:
    raise AkshareServiceError("MISSING_CODES", "缺少codes参数", 400)
  if len(codes) > max_symbols:
    raise AkshareServiceError("TOO_MANY_CODES", "单次请求股票数量过多", 400)
  return [validate_stock_code(code) for code in codes]


@router.get("/quotes")
async def quotes(request: Request, codes: str | None = None):
  parsed_codes = parse_codes(codes, request.app.state.settings.max_symbols_per_request)
  cache_key = f"quotes:{','.join(parsed_codes)}"

  async def load():
    frame = await request.app.state.client.get_spot_quotes(parsed_codes)
    return normalize_quotes(frame, parsed_codes, received_at=now_iso())

  result = await request.app.state.cache.get_or_load(
    cache_key,
    request.app.state.settings.quote_cache_seconds,
    load,
  )
  request.app.state.last_success_at = now_iso()
  data = result.value
  status = "stale" if result.is_stale else (data[0]["status"] if data else "unavailable")
  source = data[0]["source"] if data else "AKShare stock_zh_a_spot_em"
  market_timestamp = data[0]["marketTimestamp"] if data else None
  return success_response(data, source=source, market_timestamp=market_timestamp, received_at=now_iso(), status=status)
