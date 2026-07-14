import type { MinuteBar } from "../../../../types/market-data";
import { assertValidMinuteBar } from "../../minute-bars";

export function normalizeLiveMinuteBars(bars: MinuteBar[]): MinuteBar[] {
  for (const bar of bars) assertValidMinuteBar(bar);
  return bars;
}
