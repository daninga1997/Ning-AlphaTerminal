import type { MarketDailyBar } from "@/types/market-data";

export type BacktestStrategyId = "breakout" | "ema_cross" | "trend_swing_compatible";

export type BacktestSignal = {
  entry: boolean;
  exit: boolean;
  reason: string | null;
};

export type BacktestSignalInput = {
  strategy: BacktestStrategyId;
  bars: MarketDailyBar[];
  index: number;
  breakoutLookback: number;
};
