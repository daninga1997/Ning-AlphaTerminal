import type { MinuteBarPeriod, TradingSession } from "../../types/market-data";

export const marketDataCachePolicy = {
  tradingQuoteMs: 15_000,
  tradingMinute1mMs: 30_000,
  tradingMinuteHigherMs: 60_000,
  closedQuoteMs: 5 * 60_000,
  closedMinuteMs: 30 * 60_000,
} as const;

function isTrading(session: TradingSession): boolean {
  return session === "auction" || session === "morning" || session === "afternoon";
}

export function getQuoteCacheTtlMs(session: TradingSession): number {
  return isTrading(session) ? marketDataCachePolicy.tradingQuoteMs : marketDataCachePolicy.closedQuoteMs;
}

export function getMinuteCacheTtlMs(session: TradingSession, period: MinuteBarPeriod): number {
  if (!isTrading(session)) return marketDataCachePolicy.closedMinuteMs;
  return period === "1m" ? marketDataCachePolicy.tradingMinute1mMs : marketDataCachePolicy.tradingMinuteHigherMs;
}
