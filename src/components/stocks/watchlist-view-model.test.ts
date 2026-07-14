import { describe, expect, it } from "vitest";
import type { StockAnalysis } from "../../types/stock";
import { analyzeAllStocks } from "../../lib/stock-analysis";
import { getSignalSummary, getWatchlistStatistics } from "./watchlist-view-model";

function stock(overrides: Partial<StockAnalysis>): StockAnalysis {
  const base = analyzeAllStocks()[0]!;
  return { ...base, ...overrides };
}

describe("watchlist-view-model", () => {
  it("统计各类信号数量和平均综合评分", () => {
    const stats = getWatchlistStatistics([
      stock({ signal: "buy", totalScore: 90 }),
      stock({ signal: "wait", totalScore: 80 }),
      stock({ signal: "hold", totalScore: 70 }),
      stock({ signal: "reduce", totalScore: 60 }),
      stock({ signal: "avoid", totalScore: 50 }),
    ]);

    expect(stats).toEqual({
      buy: 1,
      wait: 1,
      hold: 1,
      reduce: 1,
      avoid: 1,
      averageTotalScore: 70,
    });
  });

  it("没有股票时平均综合评分为 0", () => {
    expect(getWatchlistStatistics([]).averageTotalScore).toBe(0);
  });

  it("根据交易信号生成卡片摘要", () => {
    expect(getSignalSummary(stock({ signal: "buy", trendStage: "markup" }))).toBe(
      "趋势保持完整，按计划观察建仓区。",
    );
    expect(getSignalSummary(stock({ signal: "wait" }))).toBe("等待回踩或量能确认。");
    expect(getSignalSummary(stock({ signal: "avoid" }))).toBe("条件失效，当前回避。");
  });
});
