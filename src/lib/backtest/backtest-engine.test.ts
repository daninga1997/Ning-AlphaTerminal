import { describe, expect, it } from "vitest";
import type { MarketDailyBar } from "@/types/market-data";
import { runBacktest } from "./backtest-engine";

function bar(index: number, values: Pick<MarketDailyBar, "open" | "high" | "low" | "close">): MarketDailyBar {
  const volume = 1_000;
  return {
    code: "002472",
    date: `2025-01-${String(index + 1).padStart(2, "0")}`,
    previousClose: values.close,
    volume,
    amount: values.close * volume,
    turnoverRate: 0,
    source: "tencent",
    isDemo: false,
    ...values,
  };
}

function breakoutBars(nextOpen: number, exitOpen: number): MarketDailyBar[] {
  return [
    ...Array.from({ length: 5 }, (_, index) => bar(index, { open: 10, high: 10, low: 10, close: 10 })),
    bar(5, { open: 10.5, high: 11, low: 10.4, close: 11 }),
    bar(6, { open: nextOpen, high: nextOpen, low: nextOpen, close: nextOpen }),
    bar(7, { open: 11.5, high: 11.5, low: 1, close: 1 }),
    bar(8, { open: exitOpen, high: exitOpen, low: exitOpen, close: exitOpen }),
  ];
}

describe("runBacktest", () => {
  it("fills a close-of-day breakout at the following open with slippage and a 100-share lot", () => {
    const report = runBacktest({
      bars: breakoutBars(11.5, 5),
      strategy: "breakout",
      initialCapital: 100_000,
      breakoutLookback: 5,
    });

    expect(report.trades[0]).toMatchObject({
      entryDate: "2025-01-07",
      entryPrice: 11.51,
      quantity: 8_600,
    });
  });

  it("does not fill a breakout at the signal-day close", () => {
    const report = runBacktest({
      bars: breakoutBars(11.5, 5),
      strategy: "breakout",
      initialCapital: 100_000,
      breakoutLookback: 5,
    });

    expect(report.trades[0]?.entryPrice).toBeCloseTo(11.51);
    expect(report.trades[0]?.entryPrice).not.toBe(11);
  });

  it("does not enter when the available cash cannot afford one board lot and its costs", () => {
    const report = runBacktest({
      bars: breakoutBars(11.5, 5),
      strategy: "breakout",
      initialCapital: 100,
      breakoutLookback: 5,
    });

    expect(report.trades).toEqual([]);
    expect(report.finalEquity).toBe(100);
  });

  it("force-settles an open position at the final close", () => {
    const bars = [...breakoutBars(12, 20).slice(0, 7), bar(7, { open: 20, high: 20, low: 20, close: 20 })];
    const report = runBacktest({
      bars,
      strategy: "breakout",
      initialCapital: 100_000,
      breakoutLookback: 5,
    });

    expect(report.trades).toHaveLength(1);
    expect(report.trades[0]).toMatchObject({ exitDate: "2025-01-08", exitReason: "区间结算" });
    expect(report.completedTradeCount).toBe(1);
  });

  it("derives winning metrics from completed trades", () => {
    const report = runBacktest({
      bars: breakoutBars(11.5, 15),
      strategy: "breakout",
      initialCapital: 100_000,
      breakoutLookback: 5,
    });

    expect(report.completedTradeCount).toBe(1);
    expect(report.winRatePercent).toBe(100);
    expect(report.profitLossRatio).toBeNull();
    expect(report.totalReturnPercent).toBeGreaterThan(0);
    expect(report.maxDrawdownPercent).toBeGreaterThanOrEqual(0);
    expect(report.equityCurve.at(-1)?.equity).toBe(report.finalEquity);
  });

  it("does not buy at a limit-up open (一字涨停买不进)", () => {
    const report = runBacktest({
      bars: [
        ...Array.from({ length: 5 }, (_, index) => bar(index, { open: 10, high: 10, low: 10, close: 10 })),
        bar(5, { open: 10.5, high: 11, low: 10.4, close: 11 }),
        // 次日一字涨停开盘：买不进，且收盘回落不重复触发突破信号
        bar(6, { open: 12.5, high: 12.5, low: 12.5, close: 11 }),
        bar(7, { open: 11.5, high: 11.5, low: 1, close: 1 }),
        bar(8, { open: 5, high: 5, low: 5, close: 5 }),
      ],
      strategy: "breakout",
      initialCapital: 100_000,
      breakoutLookback: 5,
    });

    expect(report.trades).toEqual([]);
    expect(report.finalEquity).toBe(100_000);
  });

  it("does not sell at a limit-down open (一字跌停卖不出)", () => {
    const report = runBacktest({
      bars: breakoutBars(11.5, 0.8),
      strategy: "breakout",
      initialCapital: 100_000,
      breakoutLookback: 5,
    });

    expect(report.trades).toHaveLength(1);
    expect(report.trades[0]).toMatchObject({
      entryDate: "2025-01-07",
      exitDate: "2025-01-09",
      exitReason: "区间结算",
    });
  });
});
