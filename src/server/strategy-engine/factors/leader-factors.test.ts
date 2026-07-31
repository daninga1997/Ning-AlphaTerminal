import { describe, expect, it } from "vitest";
import type { MarketDailyBar } from "@/types/market-data";
import { findFirstYinRepairUpTo, hasFirstYinRepairStructure } from "./leader-factors";

function bar(index: number, close: number, options: Partial<Pick<MarketDailyBar, "open" | "high" | "low" | "volume">> = {}): MarketDailyBar {
  const open = options.open ?? close;
  const high = options.high ?? Math.max(open, close);
  const low = options.low ?? Math.min(open, close);
  return {
    code: "002472",
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    open,
    high,
    low,
    close,
    previousClose: close,
    volume: options.volume ?? 1_000_000,
    amount: close * (options.volume ?? 1_000_000),
    turnoverRate: 0,
    source: "test",
    isDemo: false,
  };
}

// index 10 启动（+10%），index 12 首阴（-3%、缩量），index 13 修复确认
function makeStructureBars(): MarketDailyBar[] {
  const bars: MarketDailyBar[] = [];
  for (let index = 0; index <= 15; index += 1) {
    if (index === 10) {
      bars.push(bar(index, 11, { open: 10.5, high: 11.2, low: 10.4, volume: 2_000_000 }));
    } else if (index === 11) {
      bars.push(bar(index, 11.2, { open: 11.1, high: 11.4, low: 11 }));
    } else if (index === 12) {
      bars.push(bar(index, 10.67, { open: 11.1, high: 11.2, low: 10.6, volume: 1_200_000 }));
    } else if (index === 13) {
      bars.push(bar(index, 11, { open: 10.7, high: 11.1, low: 10.6 }));
    } else {
      bars.push(bar(index, index >= 10 ? 11 : 10));
    }
  }
  return bars;
}

describe("leader first yin factors", () => {
  it("识别启动后第2天出现的首阴与修复确认（窗口化）", () => {
    const result = findFirstYinRepairUpTo(makeStructureBars(), 13);
    expect(result).toEqual({ launchIndex: 10, firstYinIndex: 12, repairIndex: 13 });
  });

  it("首阴超出 maxDaysAfterLaunch 窗口则不识别", () => {
    const bars = makeStructureBars();
    bars[14] = bar(14, 10.67, { open: 11.1, high: 11.2, low: 10.6, volume: 1_200_000 });
    bars[15] = bar(15, 11, { open: 10.7, high: 11.1, low: 10.6 });
    expect(findFirstYinRepairUpTo(bars, 15)).toBeNull();
  });

  it("生产结构判定要求最后一根K线完成修复确认", () => {
    const bars = makeStructureBars();
    expect(hasFirstYinRepairStructure(bars.slice(0, 14))).toBe(true);
    expect(hasFirstYinRepairStructure(bars.slice(0, 13))).toBe(false);
  });
});
