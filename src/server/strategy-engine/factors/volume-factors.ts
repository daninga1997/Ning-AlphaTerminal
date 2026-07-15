import type { MarketDailyBar } from "@/types/market-data";
import { factor } from "../types/factor";

export function averageVolume(bars: MarketDailyBar[], period: number): number {
  if (bars.length < period) return 0;
  return bars.slice(-period).reduce((sum, bar) => sum + bar.volume, 0) / period;
}

export function volumeFactor(bars: MarketDailyBar[], maxScore: number) {
  const latest = bars.at(-1);
  const avg20 = averageVolume(bars, 20);
  const ratio = latest && avg20 > 0 ? latest.volume / avg20 : 0;
  const score = ratio >= 1.1 && ratio <= 2.5 ? maxScore : ratio > 0.8 ? maxScore * 0.6 : maxScore * 0.3;
  return factor("volume_structure", "量价结构", Number(ratio.toFixed(2)), score, maxScore, "daily-bars", "当前成交量相对20日均量");
}
