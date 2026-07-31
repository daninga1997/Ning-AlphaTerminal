import { describe, expect, it } from "vitest";
import type { DailyBar } from "@/types/market";
import { calculateIndicators } from "../indicators";
import { calculateTradeLevels, hasCalculatedTradeLevels } from "./trade-levels";

function makeBars(step = 0.12): DailyBar[] {
  return Array.from({ length: 120 }, (_, index) => {
    const close = 20 + index * step;
    return {
      date: `2026-01-${String(index + 1).padStart(2, "0")}`,
      open: close - 0.2,
      high: close + 0.8,
      low: close - 0.8,
      close,
      volume: 1000000 + index * 2000,
      turnover: (1000000 + index * 2000) * close,
    };
  });
}

describe("trade-levels", () => {
  it("第二建仓区低于第一建仓区", () => {
    const bars = makeBars();
    const levels = calculateTradeLevels(bars, calculateIndicators(bars));

    expect(levels.secondEntryHigh).toBeLessThan(levels.firstEntryLow);
  });

  it("止损位低于第一建仓区", () => {
    const bars = makeBars();
    const levels = calculateTradeLevels(bars, calculateIndicators(bars));

    expect(levels.stopLoss).toBeLessThan(levels.firstEntryLow);
  });

  it("第一目标位高于第一建仓区", () => {
    const bars = makeBars();
    const levels = calculateTradeLevels(bars, calculateIndicators(bars));

    expect(levels.firstTarget).toBeGreaterThan(levels.firstEntryHigh);
  });

  it("第二目标位高于第一目标位", () => {
    const bars = makeBars();
    const levels = calculateTradeLevels(bars, calculateIndicators(bars));

    expect(levels.secondTarget).toBeGreaterThan(levels.firstTarget);
  });

  it("无合理盈亏比时返回 invalidReason", () => {
    const bars = makeBars(-0.03);
    const latest = bars.at(-1)!;
    bars[119] = { ...latest, open: latest.close, high: latest.close + 0.05, low: latest.close - 0.05 };
    const levels = calculateTradeLevels(bars, calculateIndicators(bars));

    expect(levels.invalidReason).toBe("当前盈亏比不足");
  });

  it("日线数据不足时不生成交易价格", () => {
    const bars = makeBars().slice(-19);
    const levels = calculateTradeLevels(bars, calculateIndicators(bars));

    expect(levels.invalidReason).toBe("日线数据不足，无法计算交易计划");
    expect(hasCalculatedTradeLevels(levels)).toBe(false);
  });
});
