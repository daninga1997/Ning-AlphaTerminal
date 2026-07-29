import type { MarketDailyBar } from "@/types/market-data";

function hasFiniteNumbers(values: number[]): boolean {
  return values.every(Number.isFinite);
}

export function calculateEma(values: number[], period: number): number | null {
  if (!Number.isInteger(period) || period <= 0 || values.length < period || !hasFiniteNumbers(values)) return null;

  const multiplier = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  for (const value of values.slice(period)) {
    ema = value * multiplier + ema * (1 - multiplier);
  }

  return Number.isFinite(ema) ? ema : null;
}

export function previousHighestHigh(
  bars: MarketDailyBar[],
  endIndexExclusive: number,
  lookback: number,
): number | null {
  const window = bars.slice(endIndexExclusive - lookback, endIndexExclusive);
  if (!Number.isInteger(lookback) || lookback <= 0 || window.length !== lookback) return null;
  const highs = window.map((bar) => bar.high);
  return hasFiniteNumbers(highs) ? Math.max(...highs) : null;
}

export function previousLowestLow(
  bars: MarketDailyBar[],
  endIndexExclusive: number,
  lookback: number,
): number | null {
  const window = bars.slice(endIndexExclusive - lookback, endIndexExclusive);
  if (!Number.isInteger(lookback) || lookback <= 0 || window.length !== lookback) return null;
  const lows = window.map((bar) => bar.low);
  return hasFiniteNumbers(lows) ? Math.min(...lows) : null;
}

export function averageVolume(
  bars: MarketDailyBar[],
  endIndexExclusive: number,
  lookback: number,
): number | null {
  const window = bars.slice(endIndexExclusive - lookback, endIndexExclusive);
  if (!Number.isInteger(lookback) || lookback <= 0 || window.length !== lookback) return null;
  const volumes = window.map((bar) => bar.volume);
  if (!hasFiniteNumbers(volumes)) return null;
  return volumes.reduce((sum, value) => sum + value, 0) / lookback;
}
