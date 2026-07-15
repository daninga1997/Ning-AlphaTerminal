import type { TradeDecisionPermission } from "@/types/data-integrity";
import type { FactorBreakdownItem } from "./factor";
import type { EntryPlan, PriceLevel, WatchZone } from "./trade-plan";
import type { StrategyAction, StrategyConfidence, StrategyGrade, StrategyId } from "./strategy";

export type StrategyResult = {
  strategyId: StrategyId;
  strategyName: string;
  strategyVersion: string;
  code: string;
  analysisTradingDate: string;
  matched: boolean;
  permission: TradeDecisionPermission;
  totalScore: number;
  grade: StrategyGrade;
  confidence: StrategyConfidence;
  action: StrategyAction;
  factorBreakdown: FactorBreakdownItem[];
  matchedConditions: string[];
  failedConditions: string[];
  warnings: string[];
  invalidReasons: string[];
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
  cancellationConditions: string[];
  exitRules: string[];
  dataContext: {
    mode: string;
    completenessPercent: number;
    source: string | null;
  };
  calculatedAt: string;
};

export type StrategyEngineOutput = {
  strategyResults: StrategyResult[];
  finalPlan: import("./trade-plan").StrategyTradePlan;
  conflicts: string[];
};
