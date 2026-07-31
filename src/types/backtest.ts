import type { MarketDailyBar } from "@/types/market-data";

export type BacktestStrategyId =
  | "breakout"
  | "ema_cross"
  | "trend_swing_compatible"
  | "trend_swing_filtered"
  | "leader_first_yin"
  | "late_session_daily";

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

export type BacktestTrade = {
  code: string;
  signalDate: string;
  entryDate: string;
  entryPrice: number;
  entryCommission: number;
  quantity: number;
  exitDate: string;
  exitPrice: number;
  exitCommission: number;
  sellSideCharge: number;
  exitReason: string;
  holdingDays: number;
  profitLoss: number;
  returnPercent: number;
};

export type BacktestEquityPoint = {
  date: string;
  equity: number;
  cash: number;
  marketValue: number;
};

export type RunBacktestInput = {
  bars: MarketDailyBar[];
  strategy: BacktestStrategyId;
  initialCapital: number;
  breakoutLookback: number;
};

export type BacktestReport = {
  initialCapital: number;
  finalEquity: number;
  totalReturnPercent: number;
  annualizedReturnPercent: number;
  maxDrawdownPercent: number;
  winRatePercent: number | null;
  profitLossRatio: number | null;
  completedTradeCount: number;
  equityCurve: BacktestEquityPoint[];
  trades: BacktestTrade[];
};

export type BacktestHistoryRequest = {
  code: string;
  start: string;
  end: string;
};

export type BacktestHistoryResponse = {
  bars: MarketDailyBar[];
  source: string;
  updatedAt: string;
  returnedTradingDays: number;
};
