from __future__ import annotations

import platform
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Request

from ..freshness import now_iso

router = APIRouter()


@router.get("/health")
async def health(request: Request):
  try:
    import akshare as ak

    akshare_version = getattr(ak, "__version__", "unknown")
  except Exception:
    akshare_version = "unavailable"

  cache_stats: dict[str, Any] = request.app.state.cache.stats()
  return {
    "success": True,
    "data": {
      "ok": True,
      "provider": "akshare",
      "pythonVersion": platform.python_version(),
      "akshareVersion": akshare_version,
      "capabilities": {
        "quotes": True,
        "dailyBars": True,
        "minuteBars": True,
        "supportedMinutePeriods": ["1m", "5m", "15m", "30m", "60m"],
        "maxSymbolsPerRequest": request.app.state.settings.max_symbols_per_request,
      },
      "lastSuccessAt": request.app.state.last_success_at,
      "cache": cache_stats,
      "disclaimer": "公开数据接口，稳定性和时效性不等同于交易所或券商专业行情。",
    },
    "meta": {
      "provider": "akshare",
      "source": "AKShare service",
      "market_timestamp": None,
      "received_at": now_iso(),
      "status": "fresh",
      "is_demo": False,
    },
  }
