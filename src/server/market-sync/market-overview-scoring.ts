import type { MarketOverview, StockQuote } from "../../types/market-data";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildMarketOverviewFromQuotes(quotes: StockQuote[], fetchedAt = new Date()): MarketOverview {
  const advancingCount = quotes.filter((quote) => quote.changePercent > 0).length;
  const decliningCount = quotes.filter((quote) => quote.changePercent < 0).length;
  const unchangedCount = quotes.length - advancingCount - decliningCount;
  const limitUpCount = quotes.filter((quote) => quote.changePercent >= 9.8).length;
  const limitDownCount = quotes.filter((quote) => quote.changePercent <= -9.8).length;
  const totalAmount = quotes.reduce((sum, quote) => sum + quote.amount, 0);
  const advancingRatio = quotes.length ? advancingCount / quotes.length : 0;
  const limitRatioScore = limitUpCount + limitDownCount === 0 ? 7 : Math.round((limitUpCount / (limitUpCount + limitDownCount)) * 15);
  const marketScore = clamp(Math.round(20 + advancingRatio * 25 + limitRatioScore + Math.min(totalAmount / 20_000_000_000, 1) * 15), 0, 60);

  return {
    tradingSession: "closed",
    marketTimestamp: fetchedAt.toISOString(),
    receivedAt: fetchedAt.toISOString(),
    status: "partial",
    totalAmount,
    advancingCount,
    decliningCount,
    unchangedCount,
    limitUpCount,
    limitDownCount,
    marketScore,
    source: "AKShare stock_zh_a_spot market proxy",
    isDemo: false,
  };
}

export function suggestedPositionUpperBound(score: number, isComplete: boolean): string {
  if (!isComplete) return "0%-20%";
  if (score < 40) return "0%-10%";
  if (score < 55) return "10%-20%";
  if (score < 70) return "20%-40%";
  if (score < 85) return "40%-60%";
  return "60%-80%";
}
