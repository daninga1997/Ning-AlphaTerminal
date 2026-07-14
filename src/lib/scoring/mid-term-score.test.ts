import { describe, expect, it } from "vitest";
import type { DailyBar } from "@/types/market";
import { calculateIndicators } from "../indicators";
import { calculateMidTermScore } from "./mid-term-score";

function makeBars(start: number, step: number): DailyBar[] {
  return Array.from({ length: 120 }, (_, index) => {
    const close = start + index * step;
    return {
      date: `2026-01-${String(index + 1).padStart(2, "0")}`,
      open: close - 0.2,
      high: close + 0.7,
      low: close - 0.7,
      close,
      volume: 1000000 + index * 2000,
      turnover: (1000000 + index * 2000) * close,
    };
  });
}

describe("mid-term-score", () => {
  it("MA20 高于 MA60 时中期趋势分更高", () => {
    const upBars = makeBars(12, 0.15);
    const downBars = makeBars(35, -0.08);
    const up = calculateMidTermScore({ indicators: calculateIndicators(upBars), sectorScore: 85 });
    const down = calculateMidTermScore({
      indicators: calculateIndicators(downBars),
      sectorScore: 85,
    });

    expect(up.breakdown.find((item) => item.key === "trend")?.score).toBeGreaterThan(
      down.breakdown.find((item) => item.key === "trend")?.score ?? 0,
    );
  });

  it("最大回撤过大时风险分下降", () => {
    const stable = makeBars(20, 0.03);
    const volatile = makeBars(20, 0.03);
    for (let index = 80; index < 120; index += 1) {
      volatile[index] = { ...volatile[index]!, close: volatile[index]!.close * 0.65 };
    }

    const stableScore = calculateMidTermScore({
      indicators: calculateIndicators(stable),
      sectorScore: 80,
    });
    const volatileScore = calculateMidTermScore({
      indicators: calculateIndicators(volatile),
      sectorScore: 80,
    });

    expect(volatileScore.breakdown.find((item) => item.key === "drawdown")?.score).toBeLessThan(
      stableScore.breakdown.find((item) => item.key === "drawdown")?.score ?? 0,
    );
  });

  it("模拟板块评分必须被标记为演示输入", () => {
    const score = calculateMidTermScore({
      indicators: calculateIndicators(makeBars(20, 0.08)),
      sectorScore: 90,
    });

    expect(score.breakdown.find((item) => item.key === "sector")?.isDemoInput).toBe(true);
  });
});
