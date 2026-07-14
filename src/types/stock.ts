import type { IndicatorSnapshot } from "./market";
import type { MidTermGrade, ScoreResult, ShortTermGrade, TradeLevels } from "./scoring";

export type StockSignal = "buy" | "wait" | "hold" | "reduce" | "avoid";

export type TrendStage = "accumulation" | "breakout" | "markup" | "distribution" | "decline";

export type RiskLevel = "low" | "medium" | "high";

export type StockSortField =
  "totalScore" | "shortTermScore" | "midTermScore" | "changePercent" | "turnover";

export interface MockStock {
  code: string;
  name: string;
  sector: string;
  sectorScore: number;
  currentPrice: number;
  changePercent: number;
  turnover: number;
  volumeRatio: number;
  turnoverRate: number;
  trendStage: TrendStage;
  signal: StockSignal;
  riskLevel: RiskLevel;
  updatedAt: string;
}

export interface StockFilters {
  query: string;
  sector: string;
  signal: StockSignal | "all";
}

export interface DemoOpportunities {
  aLevel: StockAnalysis[];
  bLevel: StockAnalysis[];
  hasOpportunities: boolean;
}

export interface StockAnalysis extends MockStock {
  shortTermScore: ScoreResult<ShortTermGrade>;
  midTermScore: ScoreResult<MidTermGrade>;
  totalScore: number;
  tradeLevels: TradeLevels;
  indicators: IndicatorSnapshot;
  dataUpdatedAt: string;
}
