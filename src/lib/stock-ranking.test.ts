import { describe, expect, it } from "vitest";
import { mockStocks } from "../data/mock-stocks";
import type { StockAnalysis } from "../types/stock";
import {
  filterStocks,
  getDemoOpportunities,
  isShenzhenMainBoardCode,
  sortStocks,
} from "./stock-ranking";
import { analyzeAllStocks } from "./stock-analysis";

function analysis(overrides: Partial<StockAnalysis>): StockAnalysis {
  const base = analyzeAllStocks()[0]!;
  return { ...base, ...overrides };
}

describe("stock-ranking", () => {
  it("只允许 000、001、002 开头的 6 位深圳主板股票代码", () => {
    expect(isShenzhenMainBoardCode("000661")).toBe(true);
    expect(isShenzhenMainBoardCode("001696")).toBe(true);
    expect(isShenzhenMainBoardCode("002317")).toBe(true);
    expect(isShenzhenMainBoardCode("603228")).toBe(false);
    expect(isShenzhenMainBoardCode("300750")).toBe(false);
    expect(isShenzhenMainBoardCode("00231")).toBe(false);
  });

  it("模拟观察池正好 20 只且全部符合深圳主板代码范围", () => {
    expect(mockStocks).toHaveLength(20);
    expect(mockStocks.every((item) => isShenzhenMainBoardCode(item.code))).toBe(true);
  });

  it("按综合评分从高到低排序", () => {
    const sorted = sortStocks(
      [
        analysis({ code: "000001", totalScore: 70 }),
        analysis({ code: "000002", totalScore: 95 }),
        analysis({ code: "000003", totalScore: 85 }),
      ],
      "totalScore",
    );

    expect(sorted.map((item) => item.totalScore)).toEqual([95, 85, 70]);
  });

  it("A级机会最多 1 只", () => {
    const opportunities = getDemoOpportunities([
      analysis({ code: "000001", totalScore: 96, signal: "buy", riskLevel: "low" }),
      analysis({ code: "000002", totalScore: 94, signal: "buy", riskLevel: "medium" }),
    ]);

    expect(opportunities.aLevel).toHaveLength(1);
    expect(opportunities.aLevel[0]?.code).toBe("000001");
  });

  it("B级机会最多 2 只", () => {
    const opportunities = getDemoOpportunities([
      analysis({ code: "000001", totalScore: 89, signal: "wait", riskLevel: "low" }),
      analysis({ code: "000002", totalScore: 88, signal: "buy", riskLevel: "medium" }),
      analysis({ code: "000003", totalScore: 87, signal: "wait", riskLevel: "low" }),
    ]);

    expect(opportunities.bLevel).toHaveLength(2);
    expect(opportunities.bLevel.map((item) => item.code)).toEqual(["000001", "000002"]);
  });

  it("高风险股票不能成为 A级或 B级机会", () => {
    const opportunities = getDemoOpportunities([
      analysis({ code: "000001", totalScore: 96, signal: "buy", riskLevel: "high" }),
      analysis({ code: "000002", totalScore: 88, signal: "wait", riskLevel: "high" }),
    ]);

    expect(opportunities.aLevel).toEqual([]);
    expect(opportunities.bLevel).toEqual([]);
  });

  it("没有满足条件的股票时返回空列表", () => {
    const opportunities = getDemoOpportunities([
      analysis({ code: "000001", totalScore: 84, signal: "wait", riskLevel: "low" }),
      analysis({ code: "000002", totalScore: 92, signal: "avoid", riskLevel: "low" }),
    ]);

    expect(opportunities.aLevel).toEqual([]);
    expect(opportunities.bLevel).toEqual([]);
    expect(opportunities.hasOpportunities).toBe(false);
  });

  it("搜索和板块筛选结果正确", () => {
    const result = filterStocks(mockStocks, {
      query: "002317",
      sector: "创新药/医药",
      signal: "all",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("众生药业");
  });
});
