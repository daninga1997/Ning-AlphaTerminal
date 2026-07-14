from __future__ import annotations

from datetime import datetime, time
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo("Asia/Shanghai")


def now_iso() -> str:
  return datetime.now(SHANGHAI).replace(microsecond=0).isoformat()


def is_market_open(moment: datetime | None = None) -> bool:
  current = moment.astimezone(SHANGHAI) if moment else datetime.now(SHANGHAI)
  if current.weekday() >= 5:
    return False
  current_time = current.time()
  return time(9, 15) <= current_time <= time(11, 30) or time(13, 0) <= current_time <= time(15, 0)


def status_for_public_data(market_timestamp: str | None, received_at: str) -> str:
  if not market_timestamp:
    return "unavailable"
  if not is_market_open():
    return "market_closed"
  return "delayed"
