import { describe, expect, it } from "vitest";
import type { StockAnalysis } from "../../../types/stock";
import { analyzeAllStocks } from "../../../lib/stock-analysis";
import { getDecisionSummary, getEffectiveActionLabel } from "./decision-summary";

function stock(overrides: Partial<StockAnalysis>): StockAnalysis {
  const base = analyzeAllStocks()[0]!;
  return {
    ...base,
    ...overrides,
    tradeLevels: {
      ...base.tradeLevels,
      ...(overrides.tradeLevels ?? {}),
    },
    shortTermScore: {
      ...base.shortTermScore,
      ...(overrides.shortTermScore ?? {}),
    },
    midTermScore: {
      ...base.midTermScore,
      ...(overrides.midTermScore ?? {}),
    },
  };
}

describe("decision-summary", () => {
  it("buy信号但存在invalidReason时最终不能显示可以买", () => {
    const result = getDecisionSummary(
      stock({
        signal: "buy",
        tradeLevels: { ...analyzeAllStocks()[0]!.tradeLevels, invalidReason: "当前盈亏比不足" },
      }),
    );

    expect(result.actionLabel).toBe("当前不开仓");
    expect(result.summary).not.toContain("可以买");
  });

  it("风险收益比不足时显示当前不开仓", () => {
    const result = getDecisionSummary(
      stock({
        signal: "buy",
        tradeLevels: {
          ...analyzeAllStocks()[0]!.tradeLevels,
          riskRewardRatio: 1.2,
          invalidReason: null,
        },
      }),
    );

    expect(result.actionLabel).toBe("当前不开仓");
    expect(result.summary).toContain("风险收益比不足");
  });

  it("决策摘要对相同输入产生相同结果", () => {
    const input = stock({ signal: "wait" });

    expect(getDecisionSummary(input)).toEqual(getDecisionSummary(input));
  });

  it("invalidReason会覆盖原始交易信号标签", () => {
    expect(
      getEffectiveActionLabel({
        signal: "buy",
        riskRewardRatio: 2,
        invalidReason: "当前盈亏比不足",
      }),
    ).toBe("当前不开仓");
  });
});
