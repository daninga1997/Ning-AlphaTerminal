import type { MarketDataStatus, TradingSession } from "../../types/market-data";

export const freshnessThresholds = {
  freshMs: 15_000,
  delayedMs: 60_000,
} as const;

function isTradingSession(session: TradingSession): boolean {
  return session === "auction" || session === "morning" || session === "afternoon";
}

export function evaluateFreshness({
  marketTimestamp,
  now,
  tradingSession,
}: {
  marketTimestamp: string | null;
  now: string | Date;
  tradingSession: TradingSession;
}): MarketDataStatus {
  if (!marketTimestamp) return "unavailable";
  if (!isTradingSession(tradingSession)) return "market_closed";

  const ageMs = new Date(now).getTime() - new Date(marketTimestamp).getTime();
  if (ageMs <= freshnessThresholds.freshMs) return "fresh";
  if (ageMs <= freshnessThresholds.delayedMs) return "delayed";
  return "stale";
}
