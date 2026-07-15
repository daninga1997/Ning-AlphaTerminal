import asyncio

import httpx
import pandas as pd
import pytest

from app.config import Settings
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

    async def get_spot_quotes_em(self):
        return await self.get_spot_quotes(["002472", "002317", "000661"])

    async def get_spot_quotes_em_async(self):
        return await self.get_spot_quotes_em()

    async def get_spot_quotes_sina(self):
        return await self.get_spot_quotes_em()

    async def get_daily_bars(self, code, start_date=None, end_date=None, adjust="none"):
        return pd.DataFrame(
            [{"日期": "2026-07-14", "开盘": 9, "收盘": 10, "最高": 11, "最低": 8, "成交量": 100, "成交额": 1000}]
        )

    async def get_minute_bars(self, code, period, start_time=None, end_time=None):
        return pd.DataFrame(
            [{"时间": "2026-07-14 09:30:00", "开盘": 9, "收盘": 10, "最高": 11, "最低": 8, "成交量": 100, "成交额": 1000}]
        )


class SequencedQuoteStrategy:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0

    async def get_quotes(self, codes):
        from app.errors import AkshareServiceError
        from app.quote_strategy import QuoteStrategyResult

        self.calls += 1
        outcome = self.outcomes.pop(0) if self.outcomes else "fail"
        if outcome == "fail":
            raise AkshareServiceError(
                "UPSTREAM_UNAVAILABLE",
                "AKShare上游服务暂不可用",
                502,
                details={
                    "strategyUsed": None,
                    "attemptedStrategies": [{"name": "eastmoney_spot", "status": "failed"}],
                    "upstreamErrorCode": "ConnectionError",
                },
            )
        return QuoteStrategyResult(
            frame=pd.DataFrame(
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
            ),
            strategy_used="eastmoney_spot",
            attempted_strategies=[{"name": "eastmoney_spot", "status": "success"}],
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
    assert "quoteCapability" in payload["data"]
    assert "quoteCircuitState" in payload["data"]


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
async def test_quotes_response_includes_strategy_metadata():
    app = create_app(FakeClient(), quote_strategy=SequencedQuoteStrategy(["success"]))
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/quotes?codes=002472")

    payload = response.json()
    assert response.status_code == 200
    assert payload["meta"]["strategyUsed"] == "eastmoney_spot"
    assert payload["meta"]["attemptedStrategies"][0]["status"] == "success"
    assert payload["data"][0]["price"] == 10


@pytest.mark.asyncio
async def test_three_quote_failures_open_circuit_and_do_not_call_upstream_again():
    strategy = SequencedQuoteStrategy(["fail", "fail", "fail", "success"])
    app = create_app(
        FakeClient(),
        settings=Settings(quote_cache_seconds=0),
        quote_strategy=strategy,
    )
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await client.get("/quotes?codes=002472")
        await client.get("/quotes?codes=002472")
        await client.get("/quotes?codes=002472")
        response = await client.get("/quotes?codes=002472")

    assert strategy.calls == 3
    assert response.status_code == 503
    assert response.json()["meta"]["status"] == "unavailable"
    assert response.json()["meta"]["upstreamErrorCode"] == "CIRCUIT_OPEN"


@pytest.mark.asyncio
async def test_stale_quote_cache_is_returned_during_circuit_open():
    strategy = SequencedQuoteStrategy(["success", "fail", "fail", "fail", "success"])
    app = create_app(
        FakeClient(),
        settings=Settings(quote_cache_seconds=0),
        quote_strategy=strategy,
    )
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await client.get("/quotes?codes=002472")
        await client.get("/quotes?codes=002472")
        await client.get("/quotes?codes=002472")
        await client.get("/quotes?codes=002472")
        response = await client.get("/quotes?codes=002472")

    assert strategy.calls == 4
    assert response.status_code == 200
    assert response.json()["meta"]["status"] == "stale"


@pytest.mark.asyncio
async def test_daily_bars_are_not_affected_by_quote_circuit():
    strategy = SequencedQuoteStrategy(["fail", "fail", "fail"])
    fake = FakeClient()
    app = create_app(
        fake,
        settings=Settings(quote_cache_seconds=0),
        quote_strategy=strategy,
    )
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await client.get("/quotes?codes=002472")
        await client.get("/quotes?codes=002472")
        await client.get("/quotes?codes=002472")
        response = await client.get("/stocks/002472/daily-bars")

    assert response.status_code == 200
    assert response.json()["data"][0]["code"] == "002472"


@pytest.mark.asyncio
async def test_quote_circuit_recovers_after_open_window():
    strategy = SequencedQuoteStrategy(["fail", "fail", "fail", "success"])
    app = create_app(
        FakeClient(),
        settings=Settings(quote_cache_seconds=0),
        quote_strategy=strategy,
    )
    app.state.quote_circuit.open_seconds = 0
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        await client.get("/quotes?codes=002472")
        await client.get("/quotes?codes=002472")
        await client.get("/quotes?codes=002472")
        response = await client.get("/quotes?codes=002472")

    assert response.status_code == 200
    assert response.json()["meta"]["strategyUsed"] == "eastmoney_spot"


@pytest.mark.asyncio
async def test_timeout_returns_explicit_error():
    fake = FakeClient()
    fake.timeout = True
    app = create_app(fake)
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/quotes?codes=002472")

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"
    assert response.json()["meta"]["upstreamErrorCode"] == "TimeoutError"
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
    assert response.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"
    assert response.json()["meta"]["upstreamErrorCode"] == "NO_DATA"
