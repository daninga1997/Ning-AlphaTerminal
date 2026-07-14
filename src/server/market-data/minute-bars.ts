import type { MinuteBar, MinuteBarPeriod } from "../../types/market-data";
import { MarketDataError } from "./market-data-errors";

const periodMinutes: Record<MinuteBarPeriod, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "60m": 60,
};

export function assertValidMinuteBar(bar: MinuteBar): void {
  const numbers = [
    bar.open,
    bar.high,
    bar.low,
    bar.close,
    bar.volume,
    bar.amount,
    bar.averagePrice,
    bar.previousClose,
  ];
  if (numbers.some((value) => !Number.isFinite(value))) {
    throw new MarketDataError("INVALID_MINUTE_BAR", "分钟K线包含非法数值", 500);
  }
  if (bar.volume < 0 || bar.amount < 0) {
    throw new MarketDataError("INVALID_MINUTE_BAR", "分钟K线成交量或成交额不能为负", 500);
  }
  if (bar.high < Math.max(bar.open, bar.close, bar.low)) {
    throw new MarketDataError("INVALID_MINUTE_BAR", "分钟K线high字段不合法", 500);
  }
  if (bar.low > Math.min(bar.open, bar.close, bar.high)) {
    throw new MarketDataError("INVALID_MINUTE_BAR", "分钟K线low字段不合法", 500);
  }
}

function shanghaiMinuteOfDay(timestamp: string): number {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function sessionStartMinute(minuteOfDay: number): number | null {
  if (minuteOfDay >= 9 * 60 + 30 && minuteOfDay <= 11 * 60 + 30) return 9 * 60 + 30;
  if (minuteOfDay >= 13 * 60 && minuteOfDay <= 15 * 60) return 13 * 60;
  return null;
}

export function aggregateMinuteBars(bars: MinuteBar[], period: Exclude<MinuteBarPeriod, "1m">): MinuteBar[] {
  const size = periodMinutes[period];
  const groups = new Map<string, MinuteBar[]>();

  for (const bar of bars) {
    assertValidMinuteBar(bar);
    const minute = shanghaiMinuteOfDay(bar.timestamp);
    const sessionStart = sessionStartMinute(minute);
    if (sessionStart === null) continue;
    const bucket = Math.floor((minute - sessionStart) / size);
    const key = `${bar.timestamp.slice(0, 10)}:${sessionStart}:${bucket}`;
    groups.set(key, [...(groups.get(key) ?? []), bar]);
  }

  return Array.from(groups.values()).map((items) => {
    const first = items[0]!;
    const last = items.at(-1)!;
    const volume = items.reduce((sum, item) => sum + item.volume, 0);
    const amount = items.reduce((sum, item) => sum + item.amount, 0);
    const close = last.close;
    const aggregated: MinuteBar = {
      ...first,
      timestamp: last.timestamp,
      open: first.open,
      high: Math.max(...items.map((item) => item.high)),
      low: Math.min(...items.map((item) => item.low)),
      close,
      volume,
      amount,
      averagePrice: volume > 0 ? amount / volume : close,
    };
    assertValidMinuteBar(aggregated);
    return aggregated;
  });
}

export function normalizeMinuteBars(bars: MinuteBar[], period: MinuteBarPeriod): MinuteBar[] {
  if (period === "1m") return bars.map((bar) => (assertValidMinuteBar(bar), bar));
  return aggregateMinuteBars(bars, period);
}
