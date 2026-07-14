import { describe, expect, it } from "vitest";
import type { DailyBar } from "@/types/market";
import {
  calculateAtr,
  calculateEma,
  calculateIndicators,
  calculateSma,
  hasOnlyFiniteNumbers,
} from "./index";

function bar(close: number, index: number): DailyBar {
  return {
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000 + index * 10,
    turnover: (1000 + index * 10) * close,
  };
}

describe("indicators", () => {
  it("SMA 计算正确", () => {
    const values = [1, 2, 3, 4, 5];

    expect(calculateSma(values, 3)).toBe(4);
  });

  it("EMA 计算正确", () => {
    const values = [10, 12, 14, 16];

    expect(calculateEma(values, 3)).toBeCloseTo(14, 5);
  });

  it("ATR 不会产生负数", () => {
    const bars = Array.from({ length: 20 }, (_, index) => bar(10 + index * 0.2, index));
    const atr = calculateAtr(bars, 14);

    expect(atr).not.toBeNull();
    expect(atr).toBeGreaterThanOrEqual(0);
  });

  it("数据不足时返回 null 或明确结果", () => {
    expect(calculateSma([1, 2], 5)).toBeNull();
    expect(calculateEma([1, 2], 5)).toBeNull();
    expect(calculateAtr([bar(10, 0)], 14)).toBeNull();
  });

  it("指标结果中不存在 NaN 和 Infinity", () => {
    const bars = Array.from({ length: 120 }, (_, index) => bar(10 + index * 0.15, index));
    const indicators = calculateIndicators(bars);

    expect(hasOnlyFiniteNumbers(indicators)).toBe(true);
  });
});
