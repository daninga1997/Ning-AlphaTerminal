import type { StrategyInput } from "../types/strategy";
import type { PriceSupport } from "../types/trade-plan";
import { atr14, movingAverages } from "../factors/trend-factors";
import { round2 } from "../scoring/score-utils";

export function collectSupports(input: StrategyInput): PriceSupport[] {
  const bars = input.dailyBars;
  const latest = bars.at(-1);
  if (!latest) return [];
  const ma = movingAverages(bars);
  const recent20 = bars.slice(-20);
  const recentLow = Math.min(...recent20.map((bar) => bar.low));
  const platformHigh = Math.max(...recent20.slice(0, 10).map((bar) => bar.high));
  const atr = atr14(bars);
  return [
    ma.ma5 ? { label: "MA5", price: round2(ma.ma5), weight: 1 } : null,
    ma.ma10 ? { label: "MA10", price: round2(ma.ma10), weight: 2 } : null,
    ma.ma20 ? { label: "MA20", price: round2(ma.ma20), weight: 2 } : null,
    { label: "最近20日低点", price: round2(recentLow), weight: 1.5 },
    { label: "突破平台", price: round2(platformHigh), weight: 1.5 },
    { label: "ATR回撤", price: round2(latest.close - atr), weight: 1 },
  ].filter(Boolean) as PriceSupport[];
}

export function clusterSupports(supports: PriceSupport[]): PriceSupport[] {
  if (supports.length <= 3) return supports;
  return [...supports].sort((a, b) => b.weight - a.weight).slice(0, 4).sort((a, b) => a.price - b.price);
}
