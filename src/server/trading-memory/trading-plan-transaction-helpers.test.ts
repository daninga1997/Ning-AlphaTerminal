import { describe, expect, it } from "vitest";
import type { CreateTradingPlanInput, PlanReviewInput } from "./trading-plan-repository";
import { buildPlanReviewUpsertData, buildTradingPlanCreateData } from "./trading-plan-transaction-helpers";

const planInput: CreateTradingPlanInput = {
  idempotencyKey: "key",
  planDate: "2026-07-14",
  code: "002472",
  name: "双环传动",
  sector: "机器人",
  planType: "short_term",
  status: "active",
  originalSignal: "buy",
  finalSignal: "buy",
  shortTermScore: 80,
  midTermScore: 75,
  totalScore: 78,
  firstEntryLow: 10,
  firstEntryHigh: 11,
  secondEntryLow: 9,
  secondEntryHigh: 9.5,
  chaseLimit: 12,
  stopLoss: 8,
  firstTarget: 13,
  secondTarget: 14,
  riskRewardRatio: 2,
  suggestedPositionPercent: 20,
  thesis: "plan",
  reasons: ["reason"],
  warnings: ["warning"],
  invalidReason: null,
  marketDataMode: "mock",
  marketDataSource: "mock",
  marketTimestamp: "2026-07-14T08:00:00.000Z",
  calculatedAt: "2026-07-14T08:00:00.000Z",
  isDemo: true,
  snapshot: {
    quoteJson: "{}",
    indicatorsJson: "{}",
    shortScoreJson: "{}",
    midScoreJson: "{}",
    tradeLevelsJson: "{}",
    dataStatus: "fresh",
    dataSource: "mock",
    isDemo: true,
  },
};

describe("trading plan transaction helpers", () => {
  it("serializes reasons and warnings for plan creation", () => {
    expect(buildTradingPlanCreateData(planInput)).toMatchObject({
      code: "002472",
      reasons: '["reason"]',
      warnings: '["warning"]',
      marketTimestamp: new Date("2026-07-14T08:00:00.000Z"),
    });
  });

  it("defaults optional review percentages to zero for upsert", () => {
    const review: PlanReviewInput = {
      reviewDate: "2026-07-14",
      outcome: "first_target",
      entryPrice: 10,
      exitPrice: 13,
      highestPrice: 13,
      lowestPrice: 9,
      returnPercent: undefined,
      maxFavorableExcursionPercent: undefined,
      maxAdverseExcursionPercent: undefined,
      holdingDays: 2,
      followedPlan: true,
      executionNotes: "ok",
      whatWorked: "plan",
      whatFailed: "none",
      lesson: "repeat",
      isDemo: true,
    };

    expect(buildPlanReviewUpsertData("plan-1", review)).toMatchObject({
      update: {
        returnPercent: 0,
        maxFavorableExcursionPercent: 0,
        maxAdverseExcursionPercent: 0,
      },
      create: {
        tradingPlanId: "plan-1",
        returnPercent: 0,
        maxFavorableExcursionPercent: 0,
        maxAdverseExcursionPercent: 0,
      },
    });
  });
});
