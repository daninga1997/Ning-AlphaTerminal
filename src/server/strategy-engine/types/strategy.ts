import type { MarketDailyBar, MinuteBar, StockQuote } from "@/types/market-data";
import type { DataIntegrityReport, TradeDecisionPermission } from "@/types/data-integrity";

export type StrategyId = "leader_first_yin_v1" | "late_session_momentum_v1" | "trend_swing_v1";
export type StrategyGrade = "S" | "A" | "B" | "C" | "D";
export type StrategyConfidence = "high" | "medium" | "low" | "unavailable";
export type StrategyAction =
  | "focus"
  | "wait_for_pullback"
  | "breakout_watch"
  | "buy_allowed"
  | "hold"
  | "reduce"
  | "avoid"
  | "data_blocked";

export type StrategySectorSnapshot = {
  sectorId: string;
  sectorName: string;
  tradingDate: string;
  strengthScore: number;
  dataStatus: string;
  source: string;
  breakdown?: Array<{ name: string; rawValue: number | null; score: number; maxScore: number; source: string; missingReason: string | null }>;
};

export type StrategyMarketOverview = {
  tradingDate: string;
  marketScore: number;
  dataStatus: string;
  source: string;
  suggestedPositionCap?: number;
};

export interface StrategyInput {
  code: string;
  name: string;
  sectorIds: string[];
  analysisTradingDate: string;
  quote: StockQuote | null;
  dailyBars: MarketDailyBar[];
  minuteBars: MinuteBar[];
  sectorSnapshots: StrategySectorSnapshot[];
  marketOverview: StrategyMarketOverview | null;
  integrityReport: DataIntegrityReport;
  previousSignals: unknown[];
  previousTradePlans: unknown[];
  strategyVersion: string;
  calculatedAt: string;
}

export type StrategyDefinition = {
  id: StrategyId;
  name: string;
  version: string;
  run(input: StrategyInput): import("./strategy-result").StrategyResult;
};

export function hasFullPermission(input: StrategyInput): boolean {
  return input.integrityReport.permission === "full";
}

export function permissionOf(input: StrategyInput): TradeDecisionPermission {
  return input.integrityReport.permission;
}
