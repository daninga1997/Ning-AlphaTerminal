import type { MarketDailyBar } from "../../types/market-data";

export function selectCompletedDailyBars(bars: MarketDailyBar[], latestCompletedDate: string): MarketDailyBar[] {
  return bars.filter((bar) => bar.date <= latestCompletedDate);
}
