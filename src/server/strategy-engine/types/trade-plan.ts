import type { StrategyAction, StrategyConfidence, StrategyGrade, StrategyId } from "./strategy";
import type { FactorBreakdownItem } from "./factor";

export type PriceSupport = {
  label: string;
  price: number;
  weight: number;
};

export type WatchZone = {
  low: number;
  high: number;
  basis: string[];
  confidence: StrategyConfidence;
  invalidReason: string | null;
  supports: PriceSupport[];
};

export type EntryPlanType = "pullback_entry" | "deep_pullback_entry" | "breakout_entry" | "late_session_entry";

export type EntryPlan = {
  type: EntryPlanType;
  low: number;
  high: number;
  plannedEntryPrice: number;
  triggerConditions: string[];
  cancellationConditions: string[];
  suggestedPositionPercent: number;
  riskRewardRatio?: number;
};

export type PriceLevel = {
  price: number;
  basis: string[];
};

export type StrategyTradePlan = {
  code: string;
  name: string;
  isDemoPlan: boolean;
  analysisTradingDate: string;
  marketTimestamp: string | null;
  dataSource: string | null;
  dataCompleteness: number;
  marketState: string;
  sectorState: string;
  primaryStrategy: StrategyId | null;
  supportingStrategies: StrategyId[];
  grade: StrategyGrade;
  confidence: StrategyConfidence;
  currentAction: StrategyAction;
  watchZone: WatchZone;
  entryPlans: EntryPlan[];
  chaseLimit: PriceLevel & { distancePercent: number };
  stopLoss: PriceLevel;
  targets: {
    firstTarget: PriceLevel;
    secondTarget: PriceLevel;
    trailingExitRule: string;
  };
  riskRewardRatio: number;
  suggestedPositionPercent: number;
  holdingPeriod: string;
  triggerConditions: string[];
  cancellationConditions: string[];
  exitRules: string[];
  warnings: string[];
  invalidReasons: string[];
  factorBreakdown: FactorBreakdownItem[];
  strategyVersion: string;
  calculatedAt: string;
};
