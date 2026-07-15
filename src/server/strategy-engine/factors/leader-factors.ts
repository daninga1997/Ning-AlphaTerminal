import type { MarketDailyBar } from "@/types/market-data";
import { percentChange } from "../scoring/score-utils";

export function findRecentLaunchIndex(bars: MarketDailyBar[], lookback = 20): number {
  const start = Math.max(1, bars.length - lookback);
  for (let index = bars.length - 1; index >= start; index -= 1) {
    const previous = bars[index - 1];
    const current = bars[index];
    if (previous && current && percentChange(current.close, previous.close) >= 9) return index;
  }
  return -1;
}

export function hasFirstYinRepairStructure(bars: MarketDailyBar[]): boolean {
  const launch = findRecentLaunchIndex(bars);
  if (launch < 0) return false;
  const firstYin = bars[launch + 1];
  const repair = bars[launch + 2] ?? bars.at(-1);
  const launchBar = bars[launch];
  if (!firstYin || !repair || !launchBar) return false;
  const firstYinChange = percentChange(firstYin.close, launchBar.close);
  const shrinkVolume = firstYin.volume <= launchBar.volume * 1.3;
  const notLimitDown = firstYinChange > -8.5;
  const supportHeld = firstYin.close >= Math.min(launchBar.open, launchBar.close) * 0.98;
  const repairConfirmed = repair.close > firstYin.close || repair.high > firstYin.high;
  return firstYinChange >= -5 && firstYinChange <= 1 && shrinkVolume && notLimitDown && supportHeld && repairConfirmed;
}
