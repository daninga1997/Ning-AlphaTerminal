import type { Prisma } from "@prisma/client";
import type { CreateTradingPlanInput, PlanReviewInput } from "./trading-plan-repository";

export function buildTradingPlanCreateData(input: CreateTradingPlanInput): Prisma.TradingPlanCreateInput {
  return {
    idempotencyKey: input.idempotencyKey,
    planDate: input.planDate,
    code: input.code,
    name: input.name,
    sector: input.sector,
    planType: input.planType,
    status: input.status,
    originalSignal: input.originalSignal,
    finalSignal: input.finalSignal,
    shortTermScore: input.shortTermScore,
    midTermScore: input.midTermScore,
    totalScore: input.totalScore,
    firstEntryLow: input.firstEntryLow,
    firstEntryHigh: input.firstEntryHigh,
    secondEntryLow: input.secondEntryLow,
    secondEntryHigh: input.secondEntryHigh,
    chaseLimit: input.chaseLimit,
    stopLoss: input.stopLoss,
    firstTarget: input.firstTarget,
    secondTarget: input.secondTarget,
    riskRewardRatio: input.riskRewardRatio,
    suggestedPositionPercent: input.suggestedPositionPercent,
    thesis: input.thesis,
    reasons: JSON.stringify(input.reasons),
    warnings: JSON.stringify(input.warnings),
    invalidReason: input.invalidReason,
    marketDataMode: input.marketDataMode,
    marketDataSource: input.marketDataSource,
    marketTimestamp: new Date(input.marketTimestamp),
    calculatedAt: new Date(input.calculatedAt),
    isDemo: input.isDemo,
  };
}

export function buildSignalSnapshotCreateData(
  tradingPlanId: string,
  input: CreateTradingPlanInput,
): Prisma.SignalSnapshotUncheckedCreateInput {
  return {
    tradingPlanId,
    snapshotTime: new Date(input.calculatedAt),
    quoteJson: input.snapshot.quoteJson,
    indicatorsJson: input.snapshot.indicatorsJson,
    shortScoreJson: input.snapshot.shortScoreJson,
    midScoreJson: input.snapshot.midScoreJson,
    tradeLevelsJson: input.snapshot.tradeLevelsJson,
    dataStatus: input.snapshot.dataStatus,
    dataSource: input.snapshot.dataSource,
    isDemo: input.snapshot.isDemo,
  };
}

export function buildCreatedEventData(
  tradingPlanId: string,
  calculatedAt: string,
): Prisma.PlanEventUncheckedCreateInput {
  return {
    tradingPlanId,
    eventType: "created",
    eventTime: new Date(calculatedAt),
    description: "创建交易计划并冻结SignalSnapshot",
    source: "system",
    metadata: "{}",
  };
}

export function buildPlanReviewUpsertData(
  tradingPlanId: string,
  input: PlanReviewInput,
): {
  update: Prisma.PlanReviewUpdateInput;
  create: Prisma.PlanReviewUncheckedCreateInput;
} {
  const values = {
    reviewDate: input.reviewDate,
    outcome: input.outcome,
    entryPrice: input.entryPrice,
    exitPrice: input.exitPrice,
    highestPrice: input.highestPrice,
    lowestPrice: input.lowestPrice,
    returnPercent: input.returnPercent ?? 0,
    maxFavorableExcursionPercent: input.maxFavorableExcursionPercent ?? 0,
    maxAdverseExcursionPercent: input.maxAdverseExcursionPercent ?? 0,
    holdingDays: input.holdingDays,
    followedPlan: input.followedPlan,
    executionNotes: input.executionNotes,
    whatWorked: input.whatWorked,
    whatFailed: input.whatFailed,
    lesson: input.lesson,
    isDemo: input.isDemo,
  };

  return {
    update: values,
    create: {
      tradingPlanId,
      ...values,
    },
  };
}
