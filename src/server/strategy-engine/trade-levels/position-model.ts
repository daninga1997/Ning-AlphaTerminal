import type { TradeDecisionPermission } from "@/types/data-integrity";
import type { StrategyGrade } from "../types/strategy";
import { riskConfig } from "../config/risk-config";

export function calculateSuggestedPosition(input: {
  grade: StrategyGrade;
  marketCap: number;
  riskRewardRatio: number;
  stopDistancePercent: number;
  dataPermission: TradeDecisionPermission;
  marketPositionCap: number;
}): number {
  if (input.dataPermission !== "full" && input.dataPermission !== "demo") return 0;
  if (input.riskRewardRatio < riskConfig.minRiskRewardForBuy) return 0;
  const base = input.grade === "S" ? 18 : input.grade === "A" ? 12 : input.grade === "B" ? 6 : 0;
  const riskAdjusted = input.stopDistancePercent > riskConfig.highStopDistancePercent ? Math.round(base * 0.5) : base;
  return Math.max(0, Math.min(riskAdjusted, riskConfig.maxSingleStockPositionPercent, input.marketPositionCap));
}
