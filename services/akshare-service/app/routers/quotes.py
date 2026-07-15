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
  circuit = request.app.state.quote_circuit

  if not circuit.allow_request():
    cached = request.app.state.cache.get_last_success(cache_key)
    extra_meta = {
      "strategyUsed": None,
      "attemptedStrategies": circuit.last_attempted_strategies,
      "upstreamErrorCode": "CIRCUIT_OPEN",
      "status": "stale" if cached is not None else "unavailable",
    }
    if cached is not None:
      cached_payload = cached
      data = cached_payload["data"]
      meta = cached_payload["strategy_meta"]
      return success_response(
        data,
        source=meta["source"],
        market_timestamp=data[0]["marketTimestamp"] if data else None,
        received_at=now_iso(),
        status="stale",
        extra_meta=extra_meta,
      )
    raise AkshareServiceError(
      "UPSTREAM_UNAVAILABLE",
      "AKShare报价上游熔断中，暂无可用缓存",
      503,
      details=extra_meta,
    )

  async def load():
    try:
      strategy_result = await request.app.state.quote_strategy.get_quotes(parsed_codes)
      data = normalize_quotes(
        strategy_result.frame,
        parsed_codes,
        received_at=now_iso(),
        source=strategy_result.source,
      )
      circuit.record_success(strategy_result.strategy_used)
      return {
        "data": data,
        "strategy_meta": {
          "source": strategy_result.source,
          "strategyUsed": strategy_result.strategy_used,
          "attemptedStrategies": strategy_result.attempted_strategies,
          "upstreamErrorCode": strategy_result.upstream_error_code,
        },
      }
    except AkshareServiceError as error:
      circuit.record_failure(error.details.get("upstreamErrorCode") or error.code, error.details.get("attemptedStrategies"))
      raise

  result = await request.app.state.cache.get_or_load(
    cache_key,
    request.app.state.settings.quote_cache_seconds,
    load,
  )
  request.app.state.last_success_at = now_iso()
  data = result.value["data"]
  strategy_meta = result.value["strategy_meta"]
  status = "stale" if result.is_stale else (data[0]["status"] if data else "unavailable")
  source = data[0]["source"] if data else "AKShare stock_zh_a_spot_em"
  market_timestamp = data[0]["marketTimestamp"] if data else None
  extra_meta = {
    "strategyUsed": strategy_meta["strategyUsed"] if not result.is_stale else None,
    "attemptedStrategies": strategy_meta["attemptedStrategies"]
    if not result.is_stale
    else circuit.last_attempted_strategies,
    "upstreamErrorCode": strategy_meta["upstreamErrorCode"]
    if not result.is_stale
    else circuit.last_upstream_error_code,
  }
  return success_response(
    data,
    source=source,
    market_timestamp=market_timestamp,
    received_at=now_iso(),
    status=status,
    extra_meta=extra_meta,
  )
