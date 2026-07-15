from __future__ import annotations

import os
import platform
import sys
import time
from typing import Any


PROXY_KEYS = (
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
)


def proxy_status() -> dict[str, str]:
  return {key: "SET" if os.getenv(key) else "UNSET" for key in PROXY_KEYS}


def status_code_from_exception(error: BaseException) -> int | None:
  response = getattr(error, "response", None)
  return getattr(response, "status_code", None)


def diagnose_function(name: str, fn: Any) -> dict[str, Any]:
  started = time.perf_counter()
  try:
    frame = fn()
    elapsed = round(time.perf_counter() - started, 3)
    return {
      "function": name,
      "ok": True,
      "elapsedSeconds": elapsed,
      "timedOut": False,
      "emptyDataFrame": bool(getattr(frame, "empty", False)),
      "shape": list(getattr(frame, "shape", [])),
      "columns": list(getattr(frame, "columns", []))[:40],
    }
  except Exception as error:
    elapsed = round(time.perf_counter() - started, 3)
    error_type = type(error).__name__
    error_message = str(error)
    return {
      "function": name,
      "ok": False,
      "elapsedSeconds": elapsed,
      "timedOut": "timeout" in error_type.lower() or "timed out" in error_message.lower(),
      "emptyDataFrame": None,
      "httpStatusCode": status_code_from_exception(error),
      "exceptionType": error_type,
      "exceptionMessage": error_message[:500],
    }


def main() -> int:
  import akshare as ak

  print("Python:", sys.version.replace("\n", " "))
  print("Python executable:", sys.executable)
  print("Platform:", platform.platform())
  print("AKShare:", getattr(ak, "__version__", "unknown"))
  print("Proxy environment:", proxy_status())

  candidates = [
    ("stock_zh_a_spot_em", getattr(ak, "stock_zh_a_spot_em", None)),
    ("stock_zh_a_spot_em_async", getattr(ak, "stock_zh_a_spot_em_async", None)),
    ("stock_zh_a_spot", getattr(ak, "stock_zh_a_spot", None)),
  ]

  for name, fn in candidates:
    if not callable(fn):
      print({"function": name, "ok": False, "exceptionType": "MissingFunction"})
      continue
    print(diagnose_function(name, fn))

  return 0


if __name__ == "__main__":
  raise SystemExit(main())
