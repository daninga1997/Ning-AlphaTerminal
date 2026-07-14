import type { Prisma } from "@prisma/client";
import type {
  PlanEventRecord,
  PlanReviewRecord,
  SignalSnapshotRecord,
  TradingPlanRecord,
} from "./trading-plan-repository";

export type PlanWithRelations = Prisma.TradingPlanGetPayload<{
  include: { events: true; review: true; snapshot: true };
}>;

export function mapPlan(plan: PlanWithRelations): TradingPlanRecord {
  return {
    id: plan.id,
    idempotencyKey: plan.idempotencyKey,
    planDate: plan.planDate,
    code: plan.code,
    name: plan.name,
    sector: plan.sector,
    planType: plan.planType,
    status: plan.status,
    originalSignal: plan.originalSignal,
    finalSignal: plan.finalSignal,
    shortTermScore: plan.shortTermScore,
    midTermScore: plan.midTermScore,
    totalScore: plan.totalScore,
    firstEntryLow: plan.firstEntryLow,
    firstEntryHigh: plan.firstEntryHigh,
    secondEntryLow: plan.secondEntryLow,
    secondEntryHigh: plan.secondEntryHigh,
    chaseLimit: plan.chaseLimit,
    stopLoss: plan.stopLoss,
    firstTarget: plan.firstTarget,
    secondTarget: plan.secondTarget,
    riskRewardRatio: plan.riskRewardRatio,
    suggestedPositionPercent: plan.suggestedPositionPercent,
    thesis: plan.thesis,
    reasons: parseArray(plan.reasons),
    warnings: parseArray(plan.warnings),
    invalidReason: plan.invalidReason,
    marketDataMode: plan.marketDataMode as TradingPlanRecord["marketDataMode"],
    marketDataSource: plan.marketDataSource,
    marketTimestamp: plan.marketTimestamp.toISOString(),
    calculatedAt: plan.calculatedAt.toISOString(),
    archivedAt: plan.archivedAt?.toISOString() ?? null,
    isDemo: plan.isDemo,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    events: plan.events.map(mapEvent).sort((a, b) => a.eventTime.localeCompare(b.eventTime)),
    review: plan.review ? mapReview(plan.review) : null,
    snapshot: plan.snapshot ? mapSnapshot(plan.snapshot) : null,
  };
}

export function mapEvent(event: Prisma.PlanEventGetPayload<object>): PlanEventRecord {
  return {
    id: event.id,
    tradingPlanId: event.tradingPlanId,
    eventType: event.eventType,
    eventTime: event.eventTime.toISOString(),
    price: event.price,
    description: event.description,
    source: event.source,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  };
}

export function mapReview(review: Prisma.PlanReviewGetPayload<object>): PlanReviewRecord {
  return {
    id: review.id,
    tradingPlanId: review.tradingPlanId,
    reviewDate: review.reviewDate,
    outcome: review.outcome,
    entryPrice: review.entryPrice,
    exitPrice: review.exitPrice,
    highestPrice: review.highestPrice,
    lowestPrice: review.lowestPrice,
    returnPercent: review.returnPercent,
    maxFavorableExcursionPercent: review.maxFavorableExcursionPercent,
    maxAdverseExcursionPercent: review.maxAdverseExcursionPercent,
    holdingDays: review.holdingDays,
    followedPlan: review.followedPlan,
    executionNotes: review.executionNotes,
    whatWorked: review.whatWorked,
    whatFailed: review.whatFailed,
    lesson: review.lesson,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    isDemo: review.isDemo,
  };
}

export function mapSnapshot(snapshot: Prisma.SignalSnapshotGetPayload<object>): SignalSnapshotRecord {
  return {
    id: snapshot.id,
    tradingPlanId: snapshot.tradingPlanId,
    snapshotTime: snapshot.snapshotTime.toISOString(),
    quoteJson: snapshot.quoteJson,
    indicatorsJson: snapshot.indicatorsJson,
    shortScoreJson: snapshot.shortScoreJson,
    midScoreJson: snapshot.midScoreJson,
    tradeLevelsJson: snapshot.tradeLevelsJson,
    dataStatus: snapshot.dataStatus as SignalSnapshotRecord["dataStatus"],
    dataSource: snapshot.dataSource,
    isDemo: snapshot.isDemo,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

export function parseArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
