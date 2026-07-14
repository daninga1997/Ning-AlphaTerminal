import type { StockAnalysis, StockSignal } from "@/types/stock";

export type WatchlistStatistics = Record<StockSignal, number> & {
  averageTotalScore: number;
};

export function getWatchlistStatistics(stocks: StockAnalysis[]): WatchlistStatistics {
  const stats: WatchlistStatistics = {
    buy: 0,
    wait: 0,
    hold: 0,
    reduce: 0,
    avoid: 0,
    averageTotalScore: 0,
  };

  if (stocks.length === 0) return stats;

  let totalScore = 0;

  for (const stock of stocks) {
    stats[stock.signal] += 1;
    totalScore += stock.totalScore;
  }

  stats.averageTotalScore = Math.round(totalScore / stocks.length);

  return stats;
}

export function getSignalSummary(stock: StockAnalysis): string {
  if (stock.signal === "buy") {
    return stock.trendStage === "markup" || stock.trendStage === "breakout"
      ? "趋势保持完整，按计划观察建仓区。"
      : "信号满足，等待计划价格。";
  }

  if (stock.signal === "wait") return "等待回踩或量能确认。";
  if (stock.signal === "hold") return "继续跟踪，保持计划内观察。";
  if (stock.signal === "reduce") return "风险升高，优先控制仓位。";
  return "条件失效，当前回避。";
}

export function getLatestWatchlistUpdate(stocks: StockAnalysis[]): string {
  return stocks[0]?.dataUpdatedAt ?? "暂无数据";
}
