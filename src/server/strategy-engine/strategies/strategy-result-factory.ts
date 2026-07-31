import type { StrategyInput, StrategyId } from "../types/strategy";
import type { FactorBreakdownItem } from "../types/factor";
import type { StrategyResult } from "../types/strategy-result";
import { calculateWatchZone } from "../trade-levels/watch-zone-model";
import { buildEntryPlans, calculateChaseLimit } from "../trade-levels/entry-price-model";
import { calculateStopLoss } from "../trade-levels/stop-loss-model";
import { calculateTargets, calculateRiskReward } from "../trade-levels/target-model";
import { calculateSuggestedPosition } from "../trade-levels/position-model";
import { resolveGrade } from "../scoring/grade-resolver";
import { resolveConfidence } from "../scoring/confidence-resolver";
import { getMarketPositionCap } from "../factors/market-factors";
import { round2 } from "../scoring/score-utils";
import { riskConfig } from "../config/risk-config";

export function buildStrategyResult(input: StrategyInput, args: {
  strategyId: StrategyId;
  strategyName: string;
  strategyVersion: string;
  score: number;
  factors: FactorBreakdownItem[];
  matchedConditions: string[];
  failedConditions: string[];
  warnings: string[];
  invalidReasons: string[];
  holdingPeriod: string;
}): StrategyResult {
  const watchZone = calculateWatchZone(input);
  const entryPlans = buildEntryPlans(input, watchZone, args.strategyId);
  const entryRiskRewards = entryPlans.map((entry) => {
    const entryStop = calculateStopLoss(input, entry, args.strategyId);
    const entryTargets = calculateTargets(input, entry, entryStop);
    return calculateRiskReward(entry, entryStop, entryTargets.firstTarget);
  });
  entryPlans.forEach((entry, index) => {
    entry.riskRewardRatio = entryRiskRewards[index];
  });
  const primaryEntry = entryPlans[0];
  const stopLoss = calculateStopLoss(input, primaryEntry, args.strategyId);
  const targets = calculateTargets(input, primaryEntry, stopLoss);
  const riskRewardRatio = entryRiskRewards[0] ?? 0;
  const chaseLimit = calculateChaseLimit(input, watchZone);
  const grade = resolveGrade(args.score);
  const stopDistancePercent = primaryEntry.plannedEntryPrice === 0 ? 100 : ((primaryEntry.plannedEntryPrice - stopLoss.price) / primaryEntry.plannedEntryPrice) * 100;
  const currentPrice = input.quote?.price ?? 0;
  const chaseInvalid = currentPrice > chaseLimit.price;
  const rrInvalid = riskRewardRatio < riskConfig.minRiskRewardForBuy;
  const hardInvalidReasons = args.invalidReasons;
  const invalidReasons = Array.from(new Set([
    ...hardInvalidReasons,
    ...(chaseInvalid ? ["当前价超过放弃追高价"] : []),
    ...(rrInvalid ? ["风险收益比低于1.2"] : []),
  ]));
  const permission = input.integrityReport.permission;
  const matched = hardInvalidReasons.length === 0 && args.score >= 55;
  const canBuy =
    matched &&
    (permission === "full" || permission === "demo") &&
    riskRewardRatio >= riskConfig.minRiskRewardForBuy &&
    !chaseInvalid;
  const suggestedPositionPercent = calculateSuggestedPosition({
    grade,
    marketCap: 0,
    riskRewardRatio,
    stopDistancePercent,
    dataPermission: permission,
    marketPositionCap: getMarketPositionCap(input),
  });
  entryPlans.forEach((entry) => {
    entry.suggestedPositionPercent = Math.min(entry.suggestedPositionPercent, suggestedPositionPercent);
  });
  return {
    strategyId: args.strategyId,
    strategyName: args.strategyName,
    strategyVersion: args.strategyVersion,
    code: input.code,
    analysisTradingDate: input.analysisTradingDate,
    matched,
    permission,
    totalScore: Math.max(0, Math.min(100, Math.round(args.score))),
    grade: invalidReasons.length > 0 && grade === "A" ? "B" : grade,
    confidence: resolveConfidence({ score: args.score, invalidReasons, warnings: args.warnings, dataPartial: input.integrityReport.status === "partial" }),
    action: !input.quote ? "data_blocked" : canBuy ? "buy_allowed" : chaseInvalid ? "wait_for_pullback" : hardInvalidReasons.length > 0 ? "avoid" : matched ? "focus" : "focus",
    factorBreakdown: args.factors,
    matchedConditions: args.matchedConditions,
    failedConditions: [...args.failedConditions, ...invalidReasons],
    warnings: args.warnings,
    invalidReasons,
    watchZone,
    entryPlans,
    chaseLimit,
    stopLoss,
    targets,
    riskRewardRatio: round2(riskRewardRatio),
    suggestedPositionPercent,
    holdingPeriod: args.holdingPeriod,
    cancellationConditions: ["跌破策略止损结构", "板块评分跌破40", "数据完整性降级", ...primaryEntry.cancellationConditions],
    exitRules: [targets.trailingExitRule, "触及第一目标可减仓", "跌破止损位计划失效"],
    dataContext: {
      mode: input.integrityReport.marketDataMode,
      completenessPercent: input.integrityReport.completenessPercent,
      source: input.quote?.source ?? null,
    },
    calculatedAt: input.calculatedAt,
  };
}
