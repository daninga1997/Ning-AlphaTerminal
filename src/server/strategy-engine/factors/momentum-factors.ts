import type { MarketDailyBar } from "@/types/market-data";
import { factor } from "../types/factor";
import { percentChange } from "../scoring/score-utils";

export function momentumFactor(bars: MarketDailyBar[], maxScore: number) {
  const current = bars.at(-1);
  const previous = bars.at(-21);
  const change = current && previous ? percentChange(current.close, previous.close) : 0;
  return factor("momentum_20d", "20日动量", change, change > 8 ? maxScore : change > 0 ? maxScore * 0.6 : 0, maxScore, "daily-bars", "近20日涨跌幅");
}
