import { describe, expect, it } from "vitest";
import type { DailyBar } from "@/types/market";
import { calculateIndicators } from "../indicators";
import { calculateShortTermScore } from "./short-term-score";

function makeBars(start: number, step: number, volumeBoost = 1): DailyBar[] {
  return Array.from({ length: 120 }, (_, index) => {
    const close = start + index * step;
    const volume = Math.round((1000000 + index * 2000) * (index === 119 ? volumeBoost : 1));
    return {
      date: `2026-01-${String(index + 1).padStart(2, "0")}`,
      open: close - 0.2,
      high: close + 0.6,
      low: close - 0.6,
      close,
      volume,
      turnover: volume * close,
    };
  });
}

describe("short-term-score", () => {
  it("趋势和量能增强时评分上升", () => {
    const weakBars = makeBars(30, -0.04, 0.8);
    const strongBars = makeBars(20, 0.12, 1.6);

    const weak = calculateShortTermScore({
      indicators: calculateIndicators(weakBars),
      tradeLevels: { riskRewardRatio: 1.2, invalidReason: "当前盈亏比不足" },
      sectorScore: 60,
    });
    const strong = calculateShortTermScore({
      indicators: calculateIndicators(strongBars),
      tradeLevels: { riskRewardRatio: 2.4, invalidReason: null },
      sectorScore: 90,
    });

    expect(strong.total).toBeGreaterThan(weak.total);
  });

  it("RSI 严重超买时出现警告并扣分", () => {
    const bars = makeBars(10, 0.35, 2);
    const score = calculateShortTermScore({
      indicators: calculateIndicators(bars),
      tradeLevels: { riskRewardRatio: 2.2, invalidReason: null },
      sectorScore: 90,
    });

    expect(score.warnings.some((warning) => warning.includes("RSI"))).toBe(true);
    expect(score.breakdown.find((item) => item.key === "momentum")?.score).toBeLessThan(16);
  });

  it("跌破 MA20 时趋势评分下降", () => {
    const strongBars = makeBars(20, 0.12, 1.4);
    const brokenBars = makeBars(20, 0.12, 1.4);
    brokenBars[119] = { ...brokenBars[119]!, close: 18, low: 17.7, high: 19, open: 18.5 };

    const strong = calculateShortTermScore({
      indicators: calculateIndicators(strongBars),
      tradeLevels: { riskRewardRatio: 2.2, invalidReason: null },
      sectorScore: 85,
    });
    const broken = calculateShortTermScore({
      indicators: calculateIndicators(brokenBars),
      tradeLevels: { riskRewardRatio: 2.2, invalidReason: null },
      sectorScore: 85,
    });

    expect(broken.breakdown.find((item) => item.key === "trend")?.score).toBeLessThan(
      strong.breakdown.find((item) => item.key === "trend")?.score ?? 0,
    );
  });

  it("风险收益比低于 1.5 时不能获得 A 级", () => {
    const bars = makeBars(20, 0.12, 1.6);
    const score = calculateShortTermScore({
      indicators: calculateIndicators(bars),
      tradeLevels: { riskRewardRatio: 1.2, invalidReason: "当前盈亏比不足" },
      sectorScore: 95,
    });

    expect(score.grade).not.toBe("A");
  });
});
