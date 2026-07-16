"""
腾讯财经行情服务

提供实时股票报价接口，数据来源为 qt.gtimg.cn。
"""
from __future__ import annotations
import asyncio
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .quote_parser import parse_tencent_text

SHANGHAI = ZoneInfo("Asia/Shanghai")
app = FastAPI(title="Alpha Terminal - Tencent Market Data", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Health state
_last_success_at: str | None = None
_last_failure_at: str | None = None
_last_error_message: str | None = None


@app.get("/health")
async def health():
    """健康检查"""
    now = datetime.now(SHANGHAI).isoformat()
    status = "healthy" if _last_success_at else "starting"
    if _last_failure_at and not _last_success_at:
        status = "unhealthy"

    # Measure latency
    start = time.perf_counter()
    try:
        resp = requests.get("http://qt.gtimg.cn/q=sz000001", timeout=5)
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        upstream_ok = resp.status_code == 200 and len(resp.text) > 100
    except Exception:
        latency_ms = -1
        upstream_ok = False

    return {
        "provider": "tencent",
        "status": status,
        "upstream_ok": upstream_ok,
        "latency_ms": latency_ms,
        "last_success_at": _last_success_at,
        "last_failure_at": _last_failure_at,
        "last_error": _last_error_message,
        "server_time": now,
    }


@app.get("/quotes")
async def get_quotes(codes: str = Query(..., description="股票代码，逗号分隔，如 002896,000988")):
    """
    获取股票实时报价

    返回格式：{ "success": true, "data": [...QuoteRecord...], "meta": {...} }
    """
    code_list = [c.strip() for c in codes.split(",") if c.strip()]

    if not code_list:
        return {"success": False, "error": {"code": "INVALID_PARAMS", "message": "codes参数不能为空"}}

    if len(code_list) > 20:
        return {"success": False, "error": {"code": "TOO_MANY", "message": "单次最多20只股票"}}

    symbols = ",".join(f"sz{code}" for code in code_list)
    url = f"http://qt.gtimg.cn/q={symbols}"

    try:
        resp = await asyncio.to_thread(
            requests.get,
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "*/*",
                "Referer": "https://finance.qq.com/",
            },
            timeout=12,
        )
        resp.encoding = "gbk"
        text = resp.text
    except Exception as e:
        global _last_failure_at, _last_error_message
        _last_failure_at = datetime.now(SHANGHAI).isoformat()
        _last_error_message = str(e)
        return {"success": False, "error": {"code": "UPSTREAM_ERROR", "message": "腾讯行情接口请求失败"}}

    records = parse_tencent_text(text, code_list)

    if not records:
        global _last_failure_at, _last_error_message
        _last_failure_at = datetime.now(SHANGHAI).isoformat()
        _last_error_message = "腾讯行情接口返回空数据"
        return {
            "success": False,
            "error": {"code": "NO_DATA", "message": "腾讯行情接口返回空数据"},
        }

    received_at = datetime.now(SHANGHAI).isoformat()

    # Update health state
    global _last_success_at
    _last_success_at = received_at
    _last_failure_at = None
    _last_error_message = None

    return {
        "success": True,
        "data": [
            {
                "code": r.code,
                "name": r.name,
                "price": r.price,
                "previousClose": r.previous_close,
                "open": r.open,
                "high": r.high,
                "low": r.low,
                "change": r.change,
                "changePercent": r.change_percent,
                "volume": r.volume,
                "amount": r.amount,
                "turnoverRate": r.turnover_rate,
                "volumeRatio": r.volume_ratio,
                "marketTimestamp": r.market_timestamp,
                "receivedAt": received_at,
                "source": r.source,
                "status": "delayed",
                "isDemo": False,
            }
            for r in records
        ],
        "meta": {
            "source": "tencent",
            "status": "delayed",
            "received_at": received_at,
        },
    }