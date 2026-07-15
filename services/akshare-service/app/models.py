from __future__ import annotations

from typing import Any

from .freshness import now_iso


def success_response(
  data: Any,
  *,
  source: str,
  market_timestamp: str | None,
  received_at: str,
  status: str,
  extra_meta: dict[str, Any] | None = None,
):
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
      **(extra_meta or {}),
    },
  }


def error_response(code: str, message: str, *, extra_meta: dict[str, Any] | None = None):
  return {
    "success": False,
    "error": {
      "code": code,
      "message": message,
    },
    "meta": {
      "provider": "akshare",
      "received_at": now_iso(),
      **(extra_meta or {}),
    },
  }
