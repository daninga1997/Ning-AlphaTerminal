import type { DailyBar, IndicatorSnapshot, KdjValue, MacdValue } from "@/types/market";

function round(value: number, digits = 4): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function calculateSma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const slice = values.slice(-period);
  const sum = slice.reduce((total, value) => total + value, 0);
  return round(sum / period);
}

export function calculateEma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  for (const value of values.slice(period)) {
    ema = value * multiplier + ema * (1 - multiplier);
  }

  return round(ema);
}

export function calculateMacd(values: number[]): MacdValue | null {
  if (values.length < 35) return null;
  const difSeries: number[] = [];

  for (let index = 26; index <= values.length; index += 1) {
    const currentValues = values.slice(0, index);
    const ema12 = calculateEma(currentValues, 12);
    const ema26 = calculateEma(currentValues, 26);
    if (ema12 !== null && ema26 !== null) {
      difSeries.push(ema12 - ema26);
    }
  }

  const dea = calculateEma(difSeries, 9);
  const previousDea = difSeries.length > 9 ? calculateEma(difSeries.slice(0, -1), 9) : null;
  const dif = difSeries.at(-1);
  const previousDif = difSeries.at(-2);
  if (dif === undefined || previousDif === undefined || dea === null) return null;
  const histogram = (dif - dea) * 2;
  const previousHistogram = previousDea === null ? null : (previousDif - previousDea) * 2;

  return {
    dif: round(dif),
    dea: round(dea),
    histogram: round(histogram),
    previousHistogram: previousHistogram === null ? null : round(previousHistogram),
    bullishCross: previousHistogram !== null && previousDif <= previousDea! && dif > dea,
  };
}

export function calculateKdj(bars: DailyBar[], period = 9): KdjValue | null {
  if (bars.length < period) return null;
  let k = 50;
  let d = 50;

  for (let index = period - 1; index < bars.length; index += 1) {
    const window = bars.slice(index - period + 1, index + 1);
    const highest = Math.max(...window.map((bar) => bar.high));
    const lowest = Math.min(...window.map((bar) => bar.low));
    const close = bars[index]?.close;
    if (close === undefined || highest === lowest) continue;
    const rsv = ((close - lowest) / (highest - lowest)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
  }

  return {
    k: round(k),
    d: round(d),
    j: round(3 * k - 2 * d),
  };
}

export function calculateRsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;
  const changes = values.slice(1).map((value, index) => value - values[index]);
  const recent = changes.slice(-period);
  const gains = recent.filter((change) => change > 0).reduce((sum, value) => sum + value, 0);
  const losses = Math.abs(
    recent.filter((change) => change < 0).reduce((sum, value) => sum + value, 0),
  );
  if (losses === 0) return 100;
  const rs = gains / losses;
  return round(100 - 100 / (1 + rs));
}

export function calculateAtr(bars: DailyBar[], period = 14): number | null {
  if (bars.length <= period) return null;
  const trueRanges: number[] = [];

  for (let index = 1; index < bars.length; index += 1) {
    const current = bars[index];
    const previous = bars[index - 1];
    if (!current || !previous) continue;
    trueRanges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close),
      ),
    );
  }

  const atr = calculateSma(trueRanges, period);
  return atr === null ? null : Math.max(0, atr);
}

export function calculateHighestHigh(bars: DailyBar[], period: number): number | null {
  if (bars.length < period) return null;
  return round(Math.max(...bars.slice(-period).map((bar) => bar.high)));
}

export function calculateLowestLow(bars: DailyBar[], period: number): number | null {
  if (bars.length < period) return null;
  return round(Math.min(...bars.slice(-period).map((bar) => bar.low)));
}

export function calculateAverageVolume(bars: DailyBar[], period: number): number | null {
  if (bars.length < period) return null;
  const sum = bars.slice(-period).reduce((total, bar) => total + bar.volume, 0);
  return round(sum / period);
}

export function calculateChange(values: number[], period: number): number | null {
  if (values.length <= period) return null;
  const current = values.at(-1);
  const previous = values.at(-period - 1);
  if (current === undefined || previous === undefined || previous === 0) return null;
  return round(((current - previous) / previous) * 100);
}

export function calculateMaxDrawdown(values: number[]): number | null {
  if (values.length === 0) return null;
  let peak = values[0] ?? 0;
  let maxDrawdown = 0;

  for (const value of values) {
    peak = Math.max(peak, value);
    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, ((peak - value) / peak) * 100);
    }
  }

  return round(maxDrawdown);
}

export function calculateIndicators(bars: DailyBar[]): IndicatorSnapshot {
  const closes = bars.map((bar) => bar.close);
  const latestVolume = bars.at(-1)?.volume ?? null;
  const averageVolume20 = calculateAverageVolume(bars, 20);

  return {
    sma5: calculateSma(closes, 5),
    sma10: calculateSma(closes, 10),
    sma20: calculateSma(closes, 20),
    sma60: calculateSma(closes, 60),
    ema12: calculateEma(closes, 12),
    ema26: calculateEma(closes, 26),
    macd: calculateMacd(closes),
    kdj: calculateKdj(bars),
    rsi14: calculateRsi(closes, 14),
    atr14: calculateAtr(bars, 14),
    high20: calculateHighestHigh(bars, 20),
    low20: calculateLowestLow(bars, 20),
    averageVolume20,
    volumeRatio20:
      latestVolume === null || averageVolume20 === null || averageVolume20 === 0
        ? null
        : round(latestVolume / averageVolume20),
    change20: calculateChange(closes, 20),
    change60: calculateChange(closes, 60),
    maxDrawdown: calculateMaxDrawdown(closes),
  };
}

export function hasOnlyFiniteNumbers(value: unknown): boolean {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return isFiniteNumber(value);
  if (Array.isArray(value)) return value.every((item) => hasOnlyFiniteNumbers(item));
  if (typeof value === "object") {
    return Object.values(value).every((item) => hasOnlyFiniteNumbers(item));
  }
  return true;
}
