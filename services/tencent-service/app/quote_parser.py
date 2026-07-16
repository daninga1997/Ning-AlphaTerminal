"""
腾讯财经行情数据解析器

解析来自 qt.gtimg.cn 的原始文本响应，提取标准化行情字段。
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo("Asia/Shanghai")


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
    market_timestamp: str | None
    source: str


def _safe_float(raw: str) -> float | None:
    """安全转换为float，空字符串返回None"""
    if not raw or raw.strip() == "":
        return None
    try:
        return float(raw)
    except (ValueError, TypeError):
        return None


def _safe_int(raw: str) -> int | None:
    """安全转换为int，空字符串返回None"""
    if not raw or raw.strip() == "":
        return None
    try:
        return int(float(raw))
    except (ValueError, TypeError):
        return None


def _parse_timestamp(raw: str) -> str | None:
    """解析腾讯时间戳 (YYYYMMDDHHMMSS) 转为ISO格式"""
    if not raw or len(raw) < 14:
        return None
    try:
        ts = datetime(
            int(raw[0:4]),
            int(raw[4:6]),
            int(raw[6:8]),
            int(raw[8:10]),
            int(raw[10:12]),
            int(raw[12:14]),
            tzinfo=SHANGHAI,
        )
        return ts.isoformat()
    except (ValueError, IndexError):
        return None


def parse_tencent_text(text: str, requested_codes: list[str]) -> list[QuoteRecord]:
    """
    解析腾讯实时行情文本

    输入格式：v_sz002896="51~中大力德~...";\n
    字段索引：
    0=未知, 1=名称, 2=代码, 3=最新价, 4=昨收, 5=今开, 6=成交量(手),
    30=行情时间YYYYMMDDHHMMSS, 31=涨跌额, 32=涨跌幅, 33=最高, 34=最低,
    37=成交额(元), 38=换手率, 49=量比, ...
    """
    records: list[QuoteRecord] = []
    code_set = set(requested_codes)

    for line in text.strip().split("\n"):
        line = line.strip()
        if not line or "=" not in line:
            continue

        try:
            # Extract code from "v_sz002896="
            name_part, data_part = line.split('="', 1)
            raw_code = name_part.split("_")[-1]
            code = raw_code[2:] if raw_code.startswith("sz") else raw_code

            if code not in code_set:
                continue

            fields = data_part.strip('";').split("~")
            if len(fields) < 38:
                continue

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
                    volume=_safe_int(fields[6]),
                    amount=_safe_float(fields[37]) if len(fields) > 37 else None,
                    turnover_rate=_safe_float(fields[38]) if len(fields) > 38 else None,
                    volume_ratio=_safe_float(fields[49]) if len(fields) > 49 else None,
                    market_timestamp=_parse_timestamp(fields[30]) if len(fields) > 30 else None,
                    source="tencent",
                )
            )
        except (ValueError, IndexError):
            continue

    # 保持请求顺序
    records.sort(key=lambda r: requested_codes.index(r.code) if r.code in requested_codes else 999)
    return records