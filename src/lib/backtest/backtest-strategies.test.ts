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

  it("enters leader-first-yin when the repair confirms and exits below the prior low", () => {
    const bars = Array.from({ length: 16 }, (_, index) => bar(index, index >= 10 ? 11 : 10));
    bars[10] = { ...bars[10]!, open: 10.5, high: 11.2, low: 10.4, volume: 2_000_000 };
    bars[11] = { ...bars[11]!, open: 11.1, high: 11.4, low: 11, close: 11.2 };
    bars[12] = { ...bars[12]!, open: 11.1, high: 11.2, low: 10.6, volume: 1_200_000, close: 10.67 };
    bars[13] = { ...bars[13]!, open: 10.7, high: 11.1, low: 10.6, close: 11 };

    expect(evaluateBacktestSignal({ strategy: "leader_first_yin", bars, index: 13, breakoutLookback: 20 })).toMatchObject({
      entry: true,
      exit: false,
    });

    bars[14] = { ...bars[14]!, close: 10.5, low: 10.4 };
    expect(evaluateBacktestSignal({ strategy: "leader_first_yin", bars, index: 14, breakoutLookback: 20 })).toMatchObject({
      entry: false,
      exit: true,
    });
  });

  it("enters late-session daily on 2.5%-6% gain with volume expansion and exits when conditions fail", () => {
    const bars = Array.from({ length: 22 }, (_, index) => bar(index, 10, 1_000));
    bars[21] = { ...bars[21]!, close: 10.5, volume: 2_000 };

    expect(evaluateBacktestSignal({ strategy: "late_session_daily", bars, index: 21, breakoutLookback: 20 })).toMatchObject({
      entry: true,
      exit: false,
    });

    bars[21] = { ...bars[21]!, close: 10.2 };
    expect(evaluateBacktestSignal({ strategy: "late_session_daily", bars, index: 21, breakoutLookback: 20 })).toMatchObject({
      entry: false,
      exit: true,
    });
  });

  it("returns null instead of a non-finite EMA for invalid values", () => {
    expect(calculateEma([10, Number.POSITIVE_INFINITY], 2)).toBeNull();
  });
});
