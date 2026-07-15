from __future__ import annotations

import os
from dataclasses import dataclass


def _int_env(name: str, default: int) -> int:
  raw = os.getenv(name)
  if raw is None:
    return default
  try:
    return int(raw)
  except ValueError:
    return default


@dataclass(frozen=True)
class Settings:
  host: str = os.getenv("AKSHARE_SERVICE_HOST", "127.0.0.1")
  port: int = _int_env("AKSHARE_SERVICE_PORT", 8001)
  request_timeout_seconds: int = _int_env("AKSHARE_REQUEST_TIMEOUT_SECONDS", 10)
  quote_cache_seconds: int = _int_env("AKSHARE_QUOTE_CACHE_SECONDS", 30)
  quote_circuit_failure_threshold: int = _int_env("AKSHARE_QUOTE_CIRCUIT_FAILURE_THRESHOLD", 3)
  quote_circuit_open_seconds: int = _int_env("AKSHARE_QUOTE_CIRCUIT_OPEN_SECONDS", 60)
  daily_cache_seconds: int = _int_env("AKSHARE_DAILY_CACHE_SECONDS", 1800)
  minute_cache_seconds: int = _int_env("AKSHARE_MINUTE_CACHE_SECONDS", 60)
  max_symbols_per_request: int = _int_env("AKSHARE_MAX_SYMBOLS_PER_REQUEST", 20)
  allowed_origins: tuple[str, ...] = tuple(
    origin.strip()
    for origin in os.getenv("AKSHARE_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
  )


def get_settings() -> Settings:
  return Settings()
