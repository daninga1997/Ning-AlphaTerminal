from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable
from zoneinfo import ZoneInfo


SHANGHAI = ZoneInfo("Asia/Shanghai")


def _now_iso() -> str:
  return datetime.now(SHANGHAI).isoformat(timespec="seconds")


@dataclass
class QuoteCircuitBreaker:
  failure_threshold: int = 3
  open_seconds: int = 60
  now: Callable[[], float] = time.monotonic
  consecutive_failures: int = 0
  opened_at: float | None = None
  quote_last_success_at: str | None = None
  quote_last_failure_at: str | None = None
  quote_last_strategy_used: str | None = None
  last_upstream_error_code: str | None = None
  last_attempted_strategies: list[dict[str, Any]] = field(default_factory=list)

  @property
  def state(self) -> str:
    if self.opened_at is None:
      return "closed"
    if self.now() - self.opened_at >= self.open_seconds:
      return "half_open"
    return "open"

  def allow_request(self) -> bool:
    return self.state != "open"

  def record_success(self, strategy_used: str | None = None) -> None:
    self.consecutive_failures = 0
    self.opened_at = None
    self.quote_last_success_at = _now_iso()
    self.last_upstream_error_code = None
    self.quote_last_strategy_used = strategy_used

  def record_failure(
    self,
    upstream_error_code: str | None,
    attempted_strategies: list[dict[str, Any]] | None = None,
  ) -> None:
    self.consecutive_failures += 1
    self.quote_last_failure_at = _now_iso()
    self.last_upstream_error_code = upstream_error_code
    if attempted_strategies is not None:
      self.last_attempted_strategies = attempted_strategies
    if self.consecutive_failures >= self.failure_threshold:
      self.opened_at = self.now()

  def health(self) -> dict[str, Any]:
    return {
      "quoteLastSuccessAt": self.quote_last_success_at,
      "quoteLastFailureAt": self.quote_last_failure_at,
      "quoteConsecutiveFailures": self.consecutive_failures,
      "quoteCircuitState": self.state,
      "quoteLastUpstreamErrorCode": self.last_upstream_error_code,
      "quoteStrategyUsed": self.quote_last_strategy_used,
    }
