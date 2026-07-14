import asyncio

import httpx
import pandas as pd
import pytest

from app.main import create_app


class FakeClient:
    def __init__(self):
        self.quote_calls = 0
        self.timeout = False
        self.empty = False

    async def get_spot_quotes(self, codes):
        self.quote_calls += 1
        if self.timeout:
            await asyncio.sleep(0)
            raise TimeoutError("timeout")
        if self.empty:
            return pd.DataFrame()
        return pd.DataFrame(
            [
                {
                    "代码": code,
                    "名称": f"股票{code}",
                    "最新价": 10,
                    "昨收": 9,
                    "今开": 9.5,
                    "最高": 10.5,
                    "最低": 9.2,
                    "涨跌额": 1,
                    "涨跌幅": 11.11,
                    "成交量": 100,
                    "成交额": 1000,
                    "换手率": 1,
                    "量比": 1,
                }
                for code in codes
            ]
        )

    async def get_daily_bars(self, code, start_date=None, end_date=None, adjust="none"):
        return pd.DataFrame(
            [{"日期": "2026-07-14", "开盘": 9, "收盘": 10, "最高": 11, "最低": 8, "成交量": 100, "成交额": 1000}]
        )

    async def get_minute_bars(self, code, period, start_time=None, end_time=None):
        return pd.DataFrame(
            [{"时间": "2026-07-14 09:30:00", "开盘": 9, "收盘": 10, "最高": 11, "最低": 8, "成交量": 100, "成交额": 1000}]
        )


@pytest.mark.asyncio
async def test_health_does_not_leak_config():
    app = create_app(FakeClient())
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    payload = response.json()
    assert response.status_code == 200
    assert payload["success"] is True
    assert "AKSHARE_REQUEST_TIMEOUT_SECONDS" not in str(payload)


@pytest.mark.asyncio
async def test_quotes_rejects_more_than_20_codes():
    app = create_app(FakeClient())
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    codes = ",".join(f"002{index:03d}" for index in range(21))
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(f"/quotes?codes={codes}")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "TOO_MANY_CODES"


@pytest.mark.asyncio
async def test_quotes_cache_calls_upstream_once():
    fake = FakeClient()
    app = create_app(fake)
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await client.get("/quotes?codes=002472,002317")
        await client.get("/quotes?codes=002472,002317")

    assert fake.quote_calls == 1


@pytest.mark.asyncio
async def test_timeout_returns_explicit_error():
    fake = FakeClient()
    fake.timeout = True
    app = create_app(fake)
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/quotes?codes=002472")

    assert response.status_code == 504
    assert response.json()["error"]["code"] == "UPSTREAM_TIMEOUT"
    assert "Traceback" not in response.text


@pytest.mark.asyncio
async def test_empty_data_returns_no_data():
    fake = FakeClient()
    fake.empty = True
    app = create_app(fake)
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/quotes?codes=002472")

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "NO_DATA"
