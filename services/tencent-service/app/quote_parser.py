"""
腾讯财经 qt.gtimg.cn 行情数据解析器

腾讯接口返回字段下标（基于实际 QQ 行情接口 v2 文档）：
  0  = 市场代码
  1  = 名称
  2  = 代码
  3  = 最新价（元）
  4  = 昨收（元）
  5  = 今开（元）
  6  = 成交量（手，需 ×100 转为股）
  7  = 外盘（手）
  8  = 内盘（手）
  30 = 行情更新时间 YYYYMMDDHHMMSS（可能晚于收盘时间，需校验）
  31 = 涨跌额（元）
  32 = 涨跌幅（%）
  33 = 最高（元）
  34 = 最低（元）
  37 = 成交额（万元，需 ×10000 转为元）
  38 = 换手率（%）
  49 = 量比
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo("Asia/Shanghai")

# A股交易时段（北京时间）
TRADING_MORNING_START = time(9, 15)
TRADING_MORNING_END = time(11, 30)
TRADING_AFTERNOON_START = time(13, 0)
TRADING_AFTERNOON_END = time(15, 0)
MAX_POST_MARKET_MINUTES = 30  # 15:30后不再认为是有效盘中时间


@dataclass
class QuoteRecord:
    code: str
    name: str
    price: float | None
    previous_close: float | None
    open: float | None
    high: float | None
    low: float | None
    change: float | None
    change_percent: float | None
    volume: int | None
    amount: float | None
    turnover_rate: float | None
    volume_ratio: float | None
    upstream_market_time: str | None  # 腾讯原始返回的行情时间
    source: str


def _safe_float(raw: str) -> float | None:
    if not raw or raw.strip() == "":
        return None
    try:
        return float(raw)
    except (ValueError, TypeError):
        return None


def _safe_int(raw: str) -> int | None:
    if not raw or raw.strip() == "":
        return None
    try:
        return int(float(raw))
    except (ValueError, TypeError):
        return None


def _parse_timestamp(raw: str) -> str | None:
    """解析腾讯时间戳 (YYYYMMDDHHMMSS) 转为ISO格式，非法时间返回None"""
    if not raw or len(raw) < 14:
        return None
    try:
        hour = int(raw[8:10])
        minute = int(raw[10:12])
        ts = datetime(
            int(raw[0:4]),
            int(raw[4:6]),
            int(raw[6:8]),
            hour,
            minute,
            int(raw[12:14]),
            tzinfo=SHANGHAI,
        )
        # 15:30之后的时间不能作为实时市场时间
        if ts.time() > time(15, 30, 0):
            return None
        # 00:00-08:00不能作为实时市场时间
        if ts.time() < time(8, 0, 0):
            return None
        return ts.isoformat()
    except (ValueError, IndexError):
        return None


def _compute_status(upstream_time: str | None, is_trading: bool) -> str:
    """
    根据行情时间和交易时段判断状态：
    - live: 盘中且行情时间合理
    - delayed: 盘中但行情明显滞后
    - closed: 非交易时段，数据为最新收盘
    - stale: 数据日期非今日
    - unavailable: 无法解析
    """
    if not upstream_time:
        return "unavailable"

    try:
        # 解析行情日期和时间
        ts = datetime.fromisoformat(upstream_time)
        now_sh = datetime.now(SHANGHAI)
        data_date = ts.date()
        today = now_sh.date()

        if data_date < today:
            return "stale"

        if is_trading:
            age_seconds = (now_sh - ts).total_seconds()
            if age_seconds <= 180:  # 3分钟以内
                return "live"
            else:
                return "delayed"
        else:
            return "closed"
    except (ValueError, TypeError):
        return "unavailable"


def _is_trading_time() -> bool:
    """判断当前是否为交易时段"""
    now_sh = datetime.now(SHANGHAI)
    t = now_sh.time()
    return (TRADING_MORNING_START <= t <= TRADING_MORNING_END) or \
           (TRADING_AFTERNOON_START <= t <= TRADING_AFTERNOON_END)


def parse_tencent_text(text: str, requested_codes: list[str]) -> list[QuoteRecord]:
    """
    解析腾讯实时行情文本，返回标准化 QuoteRecord 列表。

    关键转换：
    - 成交量: 手 → 股（×100）
    - 成交额: 万元 → 元（×10000）
    - 行情时间仅接受 08:00-15:30 之间的值
    """
    records: list[QuoteRecord] = []
    code_set = set(requested_codes)

    for line in text.strip().split("\n"):
        line = line.strip()
        if not line or "=" not in line:
            continue

        try:
            name_part, data_part = line.split('="', 1)
            raw_code = name_part.split("_")[-1]
            code = raw_code[2:] if raw_code.startswith("sz") else raw_code

            if code not in code_set:
                continue

            fields = data_part.strip('";').split("~")
            if len(fields) < 50:  # 需要字段[49]量比
                continue

            # 成交量（手 → 股）
            vol_shou = _safe_int(fields[6])
            volume = vol_shou * 100 if vol_shou is not None else None

            # 成交额（万元 → 元）
            amt_wan = _safe_float(fields[37])
            amount = amt_wan * 10000 if amt_wan is not None else None

            # 行情时间
            upstream_market_time = _parse_timestamp(fields[30]) if len(fields) > 30 else None

            records.append(
                QuoteRecord(
                    code=code,
                    name=fields[1] if len(fields) > 1 else "",
                    price=_safe_float(fields[3]),
                    previous_close=_safe_float(fields[4]),
                    open=_safe_float(fields[5]),
                    high=_safe_float(fields[33]) if len(fields) > 33 else None,
                    low=_safe_float(fields[34]) if len(fields) > 34 else None,
                    change=_safe_float(fields[31]) if len(fields) > 31 else None,
                    change_percent=_safe_float(fields[32]) if len(fields) > 32 else None,
                    volume=volume,
                    amount=amount,
                    turnover_rate=_safe_float(fields[38]) if len(fields) > 38 else None,
                    volume_ratio=_safe_float(fields[49]) if len(fields) > 49 else None,
                    upstream_market_time=upstream_market_time,
                    source="tencent",
                )
            )
        except (ValueError, IndexError):
            continue

    records.sort(key=lambda r: requested_codes.index(r.code) if r.code in requested_codes else 999)
    return records


def validate_price_consistency(record: QuoteRecord) -> bool:
    """价格一致性校验：amount/volume 应在 high-low 合理范围内"""
    if not record.price or not record.amount or not record.volume:
        return True  # 无法校验时通过
    if record.volume <= 0:
        return False
    avg_price = record.amount / record.volume
    lo = record.low or (record.price * 0.9)
    hi = record.high or (record.price * 1.1)
    return lo * 0.5 <= avg_price <= hi * 1.5


# 导出状态判断函数供 main.py 使用
get_status = _compute_status
is_trading_time = _is_trading_time