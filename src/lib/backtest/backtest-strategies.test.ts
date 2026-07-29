import { describe, expect, it } from "vitest";
import type { MarketDailyBar } from "@/types/market-data";
import { calculateEma } from "./backtest-indicators";
import { evaluateBacktestSignal } from "./backtest-strategies";

function bar(index: number, close: number, volume = 1_000): MarketDailyBar {
  return {
    code: "002472",
    date: `2025-01-${String(index + 1).padStart(2, "0")}`,
    open: close,
    high: close,
    low: close,
    close,
    previousClose: close,
    volume,
    amount: close * volume,
    turnoverRate: 0,
    source: "tencent",
    isDemo: false,
  };
}

describe("backtest signals", () => {
  it("enters a breakout using only highs available on the signal day", () => {
    const bars = Array.from({ length: 30 }, (_, index) => bar(index, index === 20 ? 11 : 10));
    bars[25] = { ...bars[25]!, high: 30 };

    expect(evaluateBacktestSignal({
      strategy: "breakout",
      bars,
      index: 20,
      breakoutLookback: 20,
    })).toEqual({ entry: true, exit: false, reason: "突破此前20日高点" });
  });

  it("exits an EMA strategy when EMA12 crosses below EMA26", () => {
    const closes = [...Array<number>(20).fill(10), ...Array<number>(20).fill(20), 1, 1];
    const bars = closes.map((close, index) => bar(index, close));

    expect(evaluateBacktestSignal({
      strategy: "ema_cross",
      bars,
      index: bars.length - 1,
      breakoutLookback: 20,
    })).toEqual({ entry: false, exit: true, reason: "EMA12下穿EMA26" });
  });

  it("does not enter a trend-swing strategy before its 250-day preheat window", () => {
    const bars = Array.from({ length: 249 }, (_, index) => bar(index, 10 + index * 0.01));

    expect(evaluateBacktestSignal({
      strategy: "trend_swing_compatible",
      bars,
      index: bars.length - 1,
      breakoutLookback: 20,
    })).toEqual({
      entry: false,
      exit: false,
      reason: "历史数据不足：趋势波段策略需要250个交易日",
    });
  });

  it("returns null instead of a non-finite EMA for invalid values", () => {
    expect(calculateEma([10, Number.POSITIVE_INFINITY], 2)).toBeNull();
  });
});
