import { describe, expect, it } from "vitest";
import { mockStocks } from "../../../data/mock-stocks";
import { analyzeAllStocks, analyzeStock } from "../../../lib/stock-analysis";
import { getRiskItems } from "./risk-panel";

function expectFiniteDeep(value: unknown): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) expectFiniteDeep(item);
    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) expectFiniteDeep(item);
  }
}

describe("stock detail rules", () => {
  it("高风险警告能够显示在风险区域", () => {
    const highRisk = analyzeAllStocks().find((stock) => stock.riskLevel === "high")!;

    expect(getRiskItems(highRisk)).toContain("当前风险等级为高，不能作为激进开仓依据。");
  });

  it("评分分项总分与评分结果一致", () => {
    for (const stock of analyzeAllStocks()) {
      expect(stock.shortTermScore.breakdown.reduce((sum, item) => sum + item.score, 0)).toBe(
        stock.shortTermScore.total,
      );
      expect(stock.midTermScore.breakdown.reduce((sum, item) => sum + item.score, 0)).toBe(
        stock.midTermScore.total,
      );
    }
  });

  it("Mock输入能够明确标记为演示输入", () => {
    for (const stock of analyzeAllStocks()) {
      expect(stock.shortTermScore.breakdown.some((item) => item.isDemoInput)).toBe(true);
      expect(stock.midTermScore.breakdown.some((item) => item.isDemoInput)).toBe(true);
    }
  });

  it("非观察池代码返回null以触发404", () => {
    expect(analyzeStock("999999")).toBeNull();
  });

  it("20只股票详情页均可正常生成", () => {
    expect(mockStocks).toHaveLength(20);
    expect(mockStocks.every((stock) => analyzeStock(stock.code) !== null)).toBe(true);
  });

  it("页面数据不存在NaN或Infinity", () => {
    for (const stock of analyzeAllStocks()) {
      expectFiniteDeep(stock);
    }
  });

  it("所有交易价格关系符合规则", () => {
    for (const stock of analyzeAllStocks()) {
      const levels = stock.tradeLevels;

      expect(levels.secondEntryHigh).toBeLessThan(levels.firstEntryLow);
      expect(levels.stopLoss).toBeLessThan(levels.firstEntryLow);
      expect(levels.firstTarget).toBeGreaterThan(levels.firstEntryHigh);
      expect(levels.secondTarget).toBeGreaterThan(levels.firstTarget);
    }
  });
});
