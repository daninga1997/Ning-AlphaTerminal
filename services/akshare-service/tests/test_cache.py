import asyncio

import pytest

from app.cache import TTLCache


@pytest.mark.asyncio
async def test_cache_reuses_value_within_ttl():
    cache = TTLCache()
    calls = 0

    async def loader():
        nonlocal calls
        calls += 1
        return {"value": calls}

    first = await cache.get_or_load("quotes", 30, loader)
    second = await cache.get_or_load("quotes", 30, loader)

    assert first.value == {"value": 1}
    assert second.value == {"value": 1}
    assert calls == 1


@pytest.mark.asyncio
async def test_cache_coalesces_concurrent_requests():
    cache = TTLCache()
    calls = 0

    async def loader():
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.01)
        return {"value": calls}

    first, second = await asyncio.gather(
        cache.get_or_load("quotes", 30, loader),
        cache.get_or_load("quotes", 30, loader),
    )

    assert first.value == second.value == {"value": 1}
    assert calls == 1


@pytest.mark.asyncio
async def test_cache_returns_stale_fallback_when_loader_fails_after_success():
    cache = TTLCache()

    async def good_loader():
        return {"value": 1}

    async def bad_loader():
        raise RuntimeError("upstream failed")

    await cache.get_or_load("quotes", 0, good_loader)
    fallback = await cache.get_or_load("quotes", 0, bad_loader)

    assert fallback.value == {"value": 1}
    assert fallback.is_stale is True
