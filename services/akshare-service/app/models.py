from __future__ import annotations

from typing import Any

from .freshness import now_iso


def success_response(data: Any, *, source: str, market_timestamp: str | None, received_at: str, status: str):
  return {
    "success": True,
    "data": data,
    "meta": {
      "provider": "akshare",
      "source": source,
      "market_timestamp": market_timestamp,
      "received_at": received_at,
      "status": status,
      "is_demo": False,
    },
  }


def error_response(code: str, message: str):
  return {
    "success": False,
    "error": {
      "code": code,
      "message": message,
    },
    "meta": {
      "provider": "akshare",
      "received_at": now_iso(),
    },
  }
