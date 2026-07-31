type TimestampedBar = { timestamp: string };

export function selectTradingDayMinuteBars<T extends TimestampedBar>(bars: T[], tradingDate: string): T[] {
  return bars.filter((bar) => bar.timestamp.slice(0, 10) === tradingDate);
}
