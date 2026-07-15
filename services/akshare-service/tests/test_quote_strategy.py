import pandas as pd
import pytest

from app.errors import AkshareServiceError
from app.quote_strategy import AkShareQuoteStrategy


CODE = "\u4ee3\u7801"
NAME = "\u540d\u79f0"
PRICE = "\u6700\u65b0\u4ef7"


def quote_frame(code="002472"):
    return pd.DataFrame([{CODE: code, NAME: f"股票{code}", PRICE: 10}])


@pytest.mark.asyncio
async def test_primary_quote_strategy_succeeds():
    calls = []

    async def primary():
        calls.append("primary")
        return quote_frame()

    strategy = AkShareQuoteStrategy(
        fetchers={
            "eastmoney_spot": primary,
            "eastmoney_spot_async": pytest.fail,
            "sina_spot": pytest.fail,
        }
    )

    result = await strategy.get_quotes(["002472"])

    assert result.strategy_used == "eastmoney_spot"
    assert [attempt["name"] for attempt in result.attempted_strategies] == ["eastmoney_spot"]
    assert result.frame.iloc[0][CODE] == "002472"
    assert calls == ["primary"]


@pytest.mark.asyncio
async def test_backup_quote_strategy_succeeds_after_primary_failure():
    async def primary():
        raise ConnectionError("remote disconnected")

    async def backup():
        return quote_frame()

    strategy = AkShareQuoteStrategy(
        fetchers={
            "eastmoney_spot": primary,
            "eastmoney_spot_async": backup,
            "sina_spot": pytest.fail,
        }
    )

    result = await strategy.get_quotes(["002472"])

    assert result.strategy_used == "eastmoney_spot_async"
    assert [attempt["status"] for attempt in result.attempted_strategies] == ["failed", "success"]
    assert result.upstream_error_code == "ConnectionError"


@pytest.mark.asyncio
async def test_all_quote_strategies_fail_with_upstream_unavailable():
    async def fail():
        raise RuntimeError("boom")

    strategy = AkShareQuoteStrategy(
        fetchers={
            "eastmoney_spot": fail,
            "eastmoney_spot_async": fail,
            "sina_spot": fail,
        }
    )

    with pytest.raises(AkshareServiceError) as error:
        await strategy.get_quotes(["002472"])

    assert error.value.code == "UPSTREAM_UNAVAILABLE"
    assert error.value.details["attemptedStrategies"][-1]["name"] == "sina_spot"
    assert "Traceback" not in str(error.value.details)


@pytest.mark.asyncio
async def test_sina_strategy_filters_prefixed_codes_for_requested_symbols():
    async def sina():
        return pd.DataFrame(
            [
                {CODE: "sz002472", NAME: "双环传动", PRICE: 10},
                {CODE: "sh600000", NAME: "浦发银行", PRICE: 8},
            ]
        )

    strategy = AkShareQuoteStrategy(
        fetchers={
            "eastmoney_spot": lambda: (_ for _ in ()).throw(RuntimeError("primary failed")),
            "eastmoney_spot_async": lambda: (_ for _ in ()).throw(RuntimeError("backup failed")),
            "sina_spot": sina,
        }
    )

    result = await strategy.get_quotes(["002472"])

    assert result.strategy_used == "sina_spot"
    assert result.frame.iloc[0][CODE] == "sz002472"
    assert len(result.frame) == 1
