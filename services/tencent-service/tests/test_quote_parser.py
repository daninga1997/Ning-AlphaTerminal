"""腾讯行情解析器完整测试"""
import sys
import asyncio
import json
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0, 'C:/Projects/AlphaTerminal/services/tencent-service')

from app.quote_parser import (
    parse_tencent_text, QuoteRecord, validate_price_consistency,
    _safe_float, _safe_int, _parse_timestamp, get_status, is_trading_time,
)
from app.main import get_history

# 腾讯真实数据样例（收盘后快照，成交量=手，成交额=万元）
TENCENT_SAMPLE = (
    'v_sz002896="51~中大力德~002896~70.88~71.37~71.41~69720~33127~36593~70.88~131~70.86~12~70.85~2~70.84~1~70.83~132~70.89~14~70.90~36~70.92~3~70.94~1~70.95~2~~20260715150000~-0.49~-0.69~72.40~68.89~70.88/69720/49347~69720~49347~3.55~247.11~~72.40~68.89~4.92~139.30~139.30~11.79~78.51~64.23~0.62~222~70.78~314.81~222.14~~~0.66~49346.6293~5.6704~8~   A~GP-A~-20.57~-3.53~0.17~4.68~3.03~109.23~65.40~-7.03~-11.83~-3.84~196522670~196522670~66.47~-18.89~196522670~~~4.73~-0.03~~CNY~0~~71.00~-83~";'
)


def test_volume_hand_to_shares():
    """成交量'手'正确转换为'股'"""
    result = parse_tencent_text(TENCENT_SAMPLE, ["002896"])
    q = result[0]
    # 原始 69720 手 → 6,972,000 股
    assert q.volume == 6972000, f"Expected 6972000, got {q.volume}"


def test_amount_wan_to_yuan():
    """成交额'万元'正确转换为'元'"""
    result = parse_tencent_text(TENCENT_SAMPLE, ["002896"])
    q = result[0]
    # 原始 49347 万元 → 493,470,000 元
    assert q.amount == 493470000, f"Expected 493470000, got {q.amount}"


def test_price_consistency_check():
    """amount/volume 均价在 high-low 合理区间内"""
    result = parse_tencent_text(TENCENT_SAMPLE, ["002896"])
    q = result[0]
    assert validate_price_consistency(q), "均价应该合理"
    avg_price = q.amount / q.volume
    assert 65 <= avg_price <= 75, f"均价 {avg_price} 应在68.89-low ~ 72.40-high 附近"


def test_market_timestamp_parsed_correctly():
    """行情时间从正确字段解析"""
    result = parse_tencent_text(TENCENT_SAMPLE, ["002896"])
    q = result[0]
    # 15:00:00 是有效收盘时间
    assert q.upstream_market_time is not None
    assert "15:00:00" in q.upstream_market_time


def test_post_market_timestamp_is_retained_for_closed_quote():
    """收盘后的上游更新时间仍可用于标记当日收盘报价。"""
    text = TENCENT_SAMPLE.replace("20260715150000", "20260715161436")
    result = parse_tencent_text(text, ["002896"])
    q = result[0]
    assert q.upstream_market_time is not None
    assert "16:14:36" in q.upstream_market_time


def test_overnight_timestamp_rejected():
    """00:00-08:00的时间返回None"""
    text = TENCENT_SAMPLE.replace("20260715150000", "20260715033000")
    result = parse_tencent_text(text, ["002896"])
    q = result[0]
    assert q.upstream_market_time is None, "03:30:00应被拒绝"


def test_status_live_during_trading():
    """盘中实时数据标记为live"""
    # 手工设置行情时间为"当前时间3分钟前"
    from datetime import datetime, timedelta, timezone
    from zoneinfo import ZoneInfo
    SH = ZoneInfo("Asia/Shanghai")
    ts = datetime.now(SH) - timedelta(minutes=1)
    text = TENCENT_SAMPLE.replace("20260715150000", ts.strftime("%Y%m%d%H%M%S"))
    result = parse_tencent_text(text, ["002896"])
    if result:
        q = result[0]
        st = get_status(q.upstream_market_time, is_trading_time())
        # 如果是盘中，应该是live
        if is_trading_time():
            assert st == "live", f"Should be live, got {st}"
        else:
            assert st == "closed", f"Should be closed, got {st}"


def test_missing_fields_return_none():
    """缺失字段返回None而非0"""
    text = TENCENT_SAMPLE.replace("0.62", "").replace("3.55", "  ")
    result = parse_tencent_text(text, ["002896"])
    q = result[0]
    assert q.volume_ratio is None
    # 成交量仍然有效
    assert q.volume is not None


def test_invalid_text_returns_empty():
    """无效文本返回空列表"""
    result = parse_tencent_text("garbage", ["002896"])
    assert result == []


def test_history_uses_a_worker_thread_for_upstream_requests():
    """历史K线请求不能阻塞 FastAPI 的事件循环。"""
    payload = {
        "data": {
            "sz002317": {
                "qfqday": [["2026-07-21", "26.5", "27.07", "27.15", "24.61", "786580"]]
            }
        }
    }

    async def fake_to_thread(*_args, **_kwargs):
        return SimpleNamespace(text=f"kline_day={json.dumps(payload)}")

    with patch("app.main.requests.get", side_effect=AssertionError("blocking request")), patch(
        "app.main.asyncio.to_thread", side_effect=fake_to_thread
    ) as worker:
        result = asyncio.run(get_history("002317", "day", 1))

    assert worker.called
    assert result["count"] == 1


print("Running all tests...")
tests = [test_volume_hand_to_shares, test_amount_wan_to_yuan, test_price_consistency_check,
         test_market_timestamp_parsed_correctly, test_post_market_timestamp_is_retained_for_closed_quote,
         test_overnight_timestamp_rejected, test_status_live_during_trading,
         test_missing_fields_return_none, test_invalid_text_returns_empty,
         test_history_uses_a_worker_thread_for_upstream_requests]
passed = 0
failed = 0
for fn in tests:
    try:
        fn()
        passed += 1
        print(f"  PASS {fn.__name__}")
    except Exception as e:
        failed += 1
        print(f"  FAIL {fn.__name__}: {e}")

print(f"\n{passed+failed} tests: {passed} passed, {failed} failed")
sys.exit(0 if failed == 0 else 1)
