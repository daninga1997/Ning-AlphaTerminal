export interface DailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

export interface MacdValue {
  dif: number;
  dea: number;
  histogram: number;
  previousHistogram: number | null;
  bullishCross: boolean;
}

export interface KdjValue {
  k: number;
  d: number;
  j: number;
}

export interface IndicatorSnapshot {
  sma5: number | null;
  sma10: number | null;
  sma20: number | null;
  sma60: number | null;
  ema12: number | null;
  ema26: number | null;
  macd: MacdValue | null;
  kdj: KdjValue | null;
  rsi14: number | null;
  atr14: number | null;
  high20: number | null;
  low20: number | null;
  averageVolume20: number | null;
  volumeRatio20: number | null;
  change20: number | null;
  change60: number | null;
  maxDrawdown: number | null;
}
