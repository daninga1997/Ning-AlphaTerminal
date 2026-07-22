"""
腾讯财经行情服务 FastAPI 入口

GET /health   → 健康检查（含数据新鲜度）
GET /quotes?codes=002896,000988 → 实时报价
"""

from __future__ import annotations
import asyncio
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
import urllib3
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .quote_parser import parse_tencent_text, validate_price_consistency, is_trading_time
from .search_parser import parse_szse_mainboard_hints

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

SHANGHAI = ZoneInfo("Asia/Shanghai")
app = FastAPI(title="Alpha Terminal — Tencent Market Data", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/search")
async def search_stocks(query: str = Query(..., min_length=1, max_length=30)):
    """Search Tencent candidates and retain Shenzhen main-board securities only."""
    keyword = query.strip()
    if not keyword:
        return {"success": False, "error": {"code": "EMPTY_QUERY", "message": "搜索关键词不能为空"}}

    try:
        response = await asyncio.to_thread(
            requests.get,
            "https://smartbox.gtimg.cn/s3/",
            params={"q": keyword, "t": "all"},
            timeout=8,
        )
        response.raise_for_status()
    except requests.RequestException:
        return {
            "success": False,
            "error": {"code": "UPSTREAM_UNAVAILABLE", "message": "股票搜索服务暂不可用"},
        }

    return {
        "success": True,
        "data": parse_szse_mainboard_hints(response.text),
        "meta": {
            "source": "tencent_smartbox",
            "market": "SZSE",
            "scope": "mainboard",
            "received_at": datetime.now(SHANGHAI).isoformat(),
        },
    }

# 服务状态
_last_success_at: str | None = None
_last_failure_at: str | None = None
_last_error_message: str | None = None
_sample_market_time: str | None = None
_last_data_status: str = "unknown"
_last_daily_success_at: str | None = None
_last_daily_failure_at: str | None = None


@app.get("/health")
async def health():
    """增强健康检查：区分接口连通性与数据新鲜度"""
    now = datetime.now(SHANGHAI)
    now_iso = now.isoformat()

    start = time.perf_counter()
    upstream_ok = False
    try:
        resp = requests.get("http://qt.gtimg.cn/q=sz000001", timeout=5)
        upstream_ok = resp.status_code == 200 and len(resp.text) > 100
    except Exception:
        pass
    latency_ms = round((time.perf_counter() - start) * 1000, 2)

    if not upstream_ok:
        status = "unhealthy"
    elif _last_data_status in ("live", "closed"):
        status = "healthy"
    elif _last_data_status in ("delayed",):
        status = "degraded"
    else:
        status = "healthy" if _last_success_at else "starting"

    return {
        "provider": "tencent",
        "status": status,
        "upstream_ok": upstream_ok,
        "data_freshness": _last_data_status,
        "sample_code": "000001",
        "sample_market_timestamp": _sample_market_time,
        "latency_ms": latency_ms,
        "last_success_at": _last_success_at,
        "last_failure_at": _last_failure_at,
        "daily_bars_last_success_at": _last_daily_success_at,
        "daily_bars_last_failure_at": _last_daily_failure_at,
        "last_error": _last_error_message,
        "server_time": now_iso,
    }


@app.get("/quotes")
async def get_quotes(codes: str = Query(..., description="股票代码逗号分隔")):
    """拉取腾讯实时行情"""
    global _last_success_at, _last_failure_at, _last_error_message
    global _sample_market_time, _last_data_status

    code_list = [c.strip() for c in codes.split(",") if c.strip()]
    if not code_list:
        return {"success": False, "error": {"code": "INVALID_PARAMS", "message": "codes参数不能为空"}}
    if len(code_list) > 20:
        return {"success": False, "error": {"code": "TOO_MANY", "message": "单次最多20只"}}

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
        _last_failure_at = datetime.now(SHANGHAI).isoformat()
        _last_error_message = str(e)
        return {"success": False, "error": {"code": "UPSTREAM_ERROR", "message": "腾讯行情接口请求失败"}}

    records = parse_tencent_text(text, code_list)
    if not records:
        _last_failure_at = datetime.now(SHANGHAI).isoformat()
        _last_error_message = "腾讯行情接口返回空数据"
        return {"success": False, "error": {"code": "NO_DATA", "message": "腾讯行情接口返回空数据"}}

    received_at = datetime.now(SHANGHAI).isoformat()
    trading_now = is_trading_time()

    data = []
    for r in records:
        status = _compute_status(r.upstream_market_time, trading_now)
        data.append({
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
            "marketTimestamp": r.upstream_market_time,
            "receivedAt": received_at,
            "source": r.source,
            "status": status,
            "isDemo": False,
        })

    _last_success_at = received_at
    _sample_market_time = records[0].upstream_market_time if records else None
    _last_data_status = data[0]["status"] if data else "unknown"
    _last_failure_at = None
    _last_error_message = None

    return {
        "success": True,
        "data": data,
        "meta": {
            "source": "tencent",
            "status": data[0]["status"] if data else "unavailable",
            "received_at": received_at,
        },
    }


def _compute_status(upstream_time: str | None, is_trading: bool) -> str:
    if not upstream_time:
        return "unavailable"
    try:
        ts = datetime.fromisoformat(upstream_time)
        now_sh = datetime.now(SHANGHAI)
        if ts.date() < now_sh.date():
            return "stale"
        if is_trading:
            return "live" if (now_sh - ts).total_seconds() <= 180 else "delayed"
        return "closed"
    except (ValueError, TypeError):
        return "unavailable"

@app.get("/history")
async def get_history(symbol: str, period: str = "day", count: int = 120):
    """
    腾讯历史K线数据（复用腾讯财经公开接口）
    """
    global _last_daily_success_at, _last_daily_failure_at

    import re
    import json
    from datetime import datetime
    import requests

    normalized_symbol = symbol.strip().lower()
    market_symbol = normalized_symbol if normalized_symbol.startswith(("sz", "sh")) else f"sz{normalized_symbol}"
    adjustment = "qfq" if period in {"day", "week", "month"} else ""
    response_key = f"{adjustment}{period}" if adjustment else period
    url = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
    params = {
        "param": f"{market_symbol},{period},,,{count}" + (f",{adjustment}" if adjustment else ""),
        "_var": "kline_day"
    }

    try:
        resp = await asyncio.to_thread(requests.get, url, params=params, timeout=10)
        data = resp.text

        match = re.search(r'kline_day=(\{.*\})', data)
        if not match:
            return {"error": "parse failed"}

        raw_json = json.loads(match.group(1))
        stock_data = raw_json.get("data", {})
        if not isinstance(stock_data, dict):
            return {"error": "unexpected data format"}

        klines = stock_data.get(market_symbol, {}).get(response_key, [])
        if not klines:
            return {"error": "no data returned"}

        result = []
        for item in klines[:count]:
            if not isinstance(item, list) or len(item) < 6:
                continue
            result.append({
                "time": item[0],
                "open": float(item[1]),
                "close": float(item[2]),
                "high": float(item[3]),
                "low": float(item[4]),
                "volume": float(item[5])
            })

        _last_daily_success_at = datetime.now(SHANGHAI).isoformat()
        _last_daily_failure_at = None
        return {
            "symbol": symbol,
            "period": period,
            "count": len(result),
            "data": result,
            "source": "tencent",
            "updated_at": datetime.now().isoformat()
        }
    except Exception:
        _last_daily_failure_at = datetime.now(SHANGHAI).isoformat()
        return {"error": "upstream error"}
