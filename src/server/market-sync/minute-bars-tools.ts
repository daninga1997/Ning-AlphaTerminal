import type { MinuteBar, MinuteBarPeriod } from "../../types/market-data";

const periodMinutes: Record<MinuteBarPeriod, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "60m": 60,
};

export function isContinuousAuctionMinute(timestamp: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(timestamp);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const total = hour * 60 + minute;
  return (total >= 9 * 60 + 30 && total <= 11 * 60 + 30) || (total >= 13 * 60 && total <= 15 * 60);
}

export function aggregateMinuteBars(bars: MinuteBar[], targetPeriod: Exclude<MinuteBarPeriod, "1m">): MinuteBar[] {
  const size = periodMinutes[targetPeriod];
  const sorted = [...bars].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const groups = new Map<number, MinuteBar[]>();
  sorted.forEach((bar) => {
    const time = new Date(bar.timestamp);
    if (!isContinuousAuctionMinute(time)) return;
    const bucket = Math.floor(time.getTime() / (size * 60_000));
    groups.set(bucket, [...(groups.get(bucket) ?? []), bar]);
  });
  return Array.from(groups.values()).map((group) => {
    const first = group[0];
    const last = group[group.length - 1];
    return {
      ...first,
      timestamp: last.timestamp,
      high: Math.max(...group.map((bar) => bar.high)),
      low: Math.min(...group.map((bar) => bar.low)),
      close: last.close,
      volume: group.reduce((sum, bar) => sum + bar.volume, 0),
      amount: group.reduce((sum, bar) => sum + bar.amount, 0),
      averagePrice: group.reduce((sum, bar) => sum + bar.averagePrice, 0) / group.length,
      status: group.length < size ? "stale" : first.status,
    };
  });
}

export function calculateMinuteCompleteness(bars: MinuteBar[], expectedCount: number): number {
  if (expectedCount <= 0) return 0;
  const validBars = bars.filter((bar) => isContinuousAuctionMinute(new Date(bar.timestamp)));
  return Math.min(100, Math.round((validBars.length / expectedCount) * 100));
}
