from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class AkshareServiceError(Exception):
  code: str
  message: str
  status_code: int = 500
  details: dict[str, Any] = field(default_factory=dict)

  def __str__(self) -> str:
    return self.message


def normalize_error(error: Exception) -> AkshareServiceError:
  if isinstance(error, AkshareServiceError):
    return error
  if isinstance(error, TimeoutError):
    return AkshareServiceError("UPSTREAM_TIMEOUT", "AKShare上游请求超时", 504)
  return AkshareServiceError("UPSTREAM_UNAVAILABLE", "AKShare上游服务暂不可用", 502)
