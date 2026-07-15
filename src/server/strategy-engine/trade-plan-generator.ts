import { commonStrategyConfig } from "./config/common-strategy-config";
import type { StrategyInput, StrategyAction, StrategyConfidence } from "./types/strategy";
import type { StrategyResult } from "./types/strategy-result";
import type { StrategyTradePlan } from "./types/trade-plan";

const actionPriority: Record<StrategyAction, number> = {
  buy_allowed: 80,
  breakout_watch: 70,
  wait_for_pullback: 60,
  focus: 50,
  hold: 40,
  reduce: 30,
  avoid: 20,
  data_blocked: 0,
};

export function generateAlphaTradePlan(input: StrategyInput, results: StrategyResult[]): StrategyTradePlan {
  const conflicts = detectStrategyConflicts(results);
  const eligible = results
    .filter((result) => result.matched)
    .sort((a, b) => b.totalScore - a.totalScore || actionPriority[b.action] - actionPriority[a.action]);
  const primary = eligible[0] ?? [...results].sort((a, b) => b.totalScore - a.totalScore)[0] ?? null;
  const primaryResult = primary ?? buildEmptyResultLike(input);
  const permission = input.integrityReport.permission;
  const currentAction = resolveFinalAction(primaryResult.action, permission, conflicts, primaryResult.invalidReasons);
  const confidence = resolveMergedConfidence(results, primaryResult.confidence, conflicts);
  const supportingStrategies = eligible
    .filter((result) => result.strategyId !== primary?.strategyId)
    .map((result) => result.strategyId);

  return {
    code: input.code,
    name: input.name,
    analysisTradingDate: input.analysisTradingDate,
    marketTimestamp: input.quote?.marketTimestamp ?? input.integrityReport.marketTimestamp,
    dataSource: input.quote?.source ?? input.integrityReport.quoteSource,
    dataCompleteness: input.integrityReport.completenessPercent,
    marketState: describeMarketState(input.marketOverview?.marketScore ?? null),
    sectorState: describeSectorState(input.sectorSnapshots[0]?.strengthScore ?? null),
    primaryStrategy: primary?.strategyId ?? null,
    supportingStrategies,
    grade: primaryResult.grade,
    confidence,
    currentAction,
    watchZone: primaryResult.watchZone,
    entryPlans: currentAction === "data_blocked" ? [] : primaryResult.entryPlans,
    chaseLimit: primaryResult.chaseLimit,
    stopLoss: primaryResult.stopLoss,
    targets: primaryResult.targets,
    riskRewardRatio: primaryResult.riskRewardRatio,
    suggestedPositionPercent: currentAction === "buy_allowed" ? primaryResult.suggestedPositionPercent : 0,
    holdingPeriod: primaryResult.holdingPeriod,
    triggerConditions: Array.from(new Set(eligible.flatMap((result) => result.matchedConditions))),
    cancellationConditions: Array.from(new Set(results.flatMap((result) => result.cancellationConditions))),
    exitRules: Array.from(new Set(results.flatMap((result) => result.exitRules))),
    warnings: Array.from(new Set(results.flatMap((result) => result.warnings))),
    invalidReasons: Array.from(new Set([...results.flatMap((result) => result.invalidReasons), ...conflicts])),
    factorBreakdown: primaryResult.factorBreakdown,
    strategyVersion: commonStrategyConfig.version,
    calculatedAt: input.calculatedAt,
  };
}

export function detectStrategyConflicts(results: StrategyResult[]): string[] {
  const hasBuy = results.some((result) => result.action === "buy_allowed");
  const hasAvoid = results.some((result) => result.action === "avoid" && result.invalidReasons.length > 0);
  if (hasBuy && hasAvoid) return ["策略之间存在买入与回避冲突"];
  return [];
}

function resolveFinalAction(action: StrategyAction, permission: StrategyInput["integrityReport"]["permission"], conflicts: string[], invalidReasons: string[]): StrategyAction {
  if (permission === "blocked") return "data_blocked";
  if (permission !== "full") return "focus";
  if (conflicts.length > 0) return "wait_for_pullback";
  if (invalidReasons.length > 0 && action === "buy_allowed") return "wait_for_pullback";
  return action;
}

function resolveMergedConfidence(results: StrategyResult[], fallback: StrategyConfidence, conflicts: string[]): StrategyConfidence {
  if (conflicts.length > 0) return "low";
  const strongCount = results.filter((result) => result.grade === "A" || result.grade === "S").length;
  if (strongCount >= 2) return "high";
  return fallback;
}

function describeMarketState(score: number | null): string {
  if (score === null) return "市场数据不足";
  if (score < 40) return "弱势，禁止新增短线仓位";
  if (score < 55) return "偏弱，仅低风险观察";
  if (score < 70) return "精选交易";
  if (score < 85) return "正常交易";
  return "积极但受风控约束";
}

function describeSectorState(score: number | null): string {
  if (score === null) return "板块数据不足";
  if (score < 40) return "退潮";
  if (score < 55) return "偏弱";
  if (score < 70) return "轮动";
  if (score < 85) return "强势";
  return "主线";
}

function buildEmptyResultLike(input: StrategyInput): StrategyResult {
  return {
    strategyId: "trend_swing_v1",
    strategyName: "趋势波段",
    strategyVersion: commonStrategyConfig.version,
    code: input.code,
    analysisTradingDate: input.analysisTradingDate,
    matched: false,
    permission: input.integrityReport.permission,
    totalScore: 0,
    grade: "D",
    confidence: "unavailable",
    action: "data_blocked",
    factorBreakdown: [],
    matchedConditions: [],
    failedConditions: ["无可用策略结果"],
    warnings: [],
    invalidReasons: ["无可用策略结果"],
    watchZone: { low: 0, high: 0, basis: [], confidence: "unavailable", invalidReason: "无可用策略结果", supports: [] },
    entryPlans: [],
    chaseLimit: { price: 0, basis: [], distancePercent: 0 },
    stopLoss: { price: 0, basis: [] },
    targets: { firstTarget: { price: 0, basis: [] }, secondTarget: { price: 0, basis: [] }, trailingExitRule: "无" },
    riskRewardRatio: 0,
    suggestedPositionPercent: 0,
    holdingPeriod: "无",
    cancellationConditions: [],
    exitRules: [],
    dataContext: { mode: input.integrityReport.marketDataMode, completenessPercent: input.integrityReport.completenessPercent, source: null },
    calculatedAt: input.calculatedAt,
  };
}
