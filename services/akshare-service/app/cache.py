from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Awaitable, Callable, Generic, TypeVar

T = TypeVar("T")


@dataclass
class CacheResult(Generic[T]):
  value: T
  is_stale: bool = False


@dataclass
class CacheEntry(Generic[T]):
  value: T
  expires_at: float


class TTLCache:
  def __init__(self):
    self._entries: dict[str, CacheEntry] = {}
    self._last_success: dict[str, object] = {}
    self._locks: dict[str, asyncio.Lock] = {}

  async def get_or_load(self, key: str, ttl_seconds: int, loader: Callable[[], Awaitable[T]]) -> CacheResult[T]:
    now = time.monotonic()
    entry = self._entries.get(key)
    if entry and entry.expires_at > now:
      return CacheResult(entry.value)

    lock = self._locks.setdefault(key, asyncio.Lock())
    async with lock:
      now = time.monotonic()
      entry = self._entries.get(key)
      if entry and entry.expires_at > now:
        return CacheResult(entry.value)

      try:
        value = await loader()
      except Exception:
        if key in self._last_success:
          return CacheResult(self._last_success[key], is_stale=True)  # type: ignore[arg-type]
        raise

      expires_at = time.monotonic() + max(0, ttl_seconds)
      self._entries[key] = CacheEntry(value=value, expires_at=expires_at)
      self._last_success[key] = value
      return CacheResult(value)

  def stats(self) -> dict[str, int]:
    return {
      "entries": len(self._entries),
      "lastSuccessEntries": len(self._last_success),
    }
