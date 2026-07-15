import type { StoredDailyMarketBar, StoredMinuteMarketBar } from "./market-data-repository";

export function dedupeDailyBars(bars: StoredDailyMarketBar[]): StoredDailyMarketBar[] {
  return Array.from(new Map(bars.map((bar) => [`${bar.code}:${bar.tradingDate}:${bar.adjustment}:${bar.source}`, bar])).values());
}

export function dedupeMinuteBars(bars: StoredMinuteMarketBar[]): StoredMinuteMarketBar[] {
  return Array.from(new Map(bars.map((bar) => [`${bar.code}:${bar.timestamp.toISOString()}:${bar.period}:${bar.source}`, bar])).values());
}
