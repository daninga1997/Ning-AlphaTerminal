import { describe, expect, it } from "vitest";
import type { DailyBar } from "@/types/market";
import type { MinuteBar } from "@/types/market-data";
import { buildMinuteRequestUrl, getMinuteTrendMetrics } from "./minute-trend-panel";
import { makeStockPriceChartData } from "./stock-price-chart";
import { chartPeriods } from "./stock-chart-period-panel";

function dailyBar(index: number): DailyBar {
  return {
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    open: 10 + index,
    high: 11 + index,
    low: 9 + index,
    close: 10 + index,
    volume: 100_000 + index,
    turnover: 1,
  };
}

function minuteBar(index: number): MinuteBar {
  const close = 10 + index;
  return {
    code: "002472",
    timestamp: `2026-07-14T09:${String(30 + index).padStart(2, "0")}:00+08:00`,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000 + index,
    amount: 10_000 + index,
    averagePrice: close,
    previousClose: 10,
    source: "mock",
    receivedAt: "2026-07-14T10:30:00+08:00",
    status: "fresh",
    isDemo: true,
  };
}

describe("chart data derivation", () => {
  it("derives deterministic stock price chart points without changing output shape", () => {
    const bars = Array.from({ length: 20 }, (_, index) => dailyBar(index));

    const first = makeStockPriceChartData(bars);
    const second = makeStockPriceChartData(bars);

    expect(second).toEqual(first);
    expect(first.at(-1)).toMatchObject({
      date: "01-20",
      close: 29,
      ma5: 27,
      ma10: 24.5,
      ma20: 19.5,
      volume: 10,
    });
  });

  it("derives deterministic minute metrics for chart rendering", () => {
    const bars = [minuteBar(0), minuteBar(1), minuteBar(2)];

    expect(getMinuteTrendMetrics(bars)).toEqual({
      latest: bars[2],
      high: 13,
      low: 9,
      chartData: [
        { time: "09:30", close: 10, volume: 1000 },
        { time: "09:31", close: 11, volume: 1001 },
        { time: "09:32", close: 12, volume: 1002 },
      ],
    });
  });

  it("supports one daily period and five minute periods", () => {
    expect(chartPeriods).toEqual(["day", "1m", "5m", "15m", "30m", "60m"]);
  });

  it("builds a live request for each supported minute period", () => {
    for (const period of ["1m", "5m", "15m", "30m", "60m"] as const) {
      expect(buildMinuteRequestUrl("002472", period, "live")).toBe(
        `/api/market/stocks/002472/minutes?period=${period}&limit=120`,
      );
    }
  });

  it("adds replay mode only when explicitly selected", () => {
    expect(buildMinuteRequestUrl("002472", "15m", "replay")).toBe(
      "/api/market/stocks/002472/minutes?period=15m&limit=120&mode=replay",
    );
  });
});
