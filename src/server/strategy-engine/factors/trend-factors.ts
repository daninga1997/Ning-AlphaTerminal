import { calculateAtr, calculateMaxDrawdown, calculateSma } from "../../../lib/indicators/index";
import type { MarketDailyBar } from "@/types/market-data";
import { factor } from "../types/factor";
import type { FactorBreakdownItem } from "../types/factor";

export function closes(bars: MarketDailyBar[]): number[] {
  return bars.map((bar) => bar.close);
}

export function movingAverages(bars: MarketDailyBar[]) {
  const values = closes(bars);
  return {
    ma5: calculateSma(values, 5),
    ma10: calculateSma(values, 10),
    ma20: calculateSma(values, 20),
    ma60: calculateSma(values, 60),
    ma120: calculateSma(values, 120),
  };
}

export function trendFactor(bars: MarketDailyBar[], maxScore: number): FactorBreakdownItem {
  const ma = movingAverages(bars);
  const latest = bars.at(-1);
  let score = 0;
  if (latest && ma.ma20 !== null && latest.close >= ma.ma20) score += maxScore * 0.3;
  if (ma.ma20 !== null && ma.ma60 !== null && ma.ma20 > ma.ma60) score += maxScore * 0.4;
  if (bars.length >= 61 && bars.at(-1)!.close > bars.at(-60)!.close) score += maxScore * 0.3;
  return factor("trend_structure", "趋势结构", ma.ma20 && ma.ma60 ? `MA20 ${ma.ma20} / MA60 ${ma.ma60}` : null, score, maxScore, "daily-bars", "MA20/MA60与收盘位置");
}

export function maxDrawdownPercent(bars: MarketDailyBar[]): number {
  return calculateMaxDrawdown(closes(bars)) ?? 100;
}

export function atr14(bars: MarketDailyBar[]): number {
  const compatibleBars = bars.map((bar) => ({
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    turnover: bar.amount,
    date: bar.date,
  }));
  return calculateAtr(compatibleBars, 14) ?? Math.max(0.01, (bars.at(-1)?.close ?? 1) * 0.03);
}
