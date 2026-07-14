import { describe, expect, it } from "vitest";
import { mapEvent, mapPlan, parseArray } from "./trading-plan-mappers";

const now = new Date("2026-07-14T08:00:00.000Z");

describe("trading plan mappers", () => {
  it("parses stored json arrays defensively", () => {
    expect(parseArray('["a",1]')).toEqual(["a", "1"]);
    expect(parseArray("{}")).toEqual([]);
    expect(parseArray("not-json")).toEqual([]);
  });

  it("maps events to serializable records", () => {
    expect(
      mapEvent({
        id: "event-1",
        tradingPlanId: "plan-1",
        eventType: "created",
        eventTime: now,
        price: null,
        description: "created",
        source: "system",
        metadata: "{}",
        createdAt: now,
      } as never),
    ).toEqual({
      id: "event-1",
      tradingPlanId: "plan-1",
      eventType: "created",
      eventTime: now.toISOString(),
      price: null,
      description: "created",
      source: "system",
      metadata: "{}",
      createdAt: now.toISOString(),
    });
  });

  it("maps plans and keeps event timeline sorted ascending", () => {
    const later = new Date("2026-07-14T09:00:00.000Z");
    const plan = mapPlan({
      id: "plan-1",
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
      reasons: '["reason"]',
      warnings: '["warning"]',
      invalidReason: null,
      marketDataMode: "mock",
      marketDataSource: "mock",
      marketTimestamp: now,
      calculatedAt: now,
      archivedAt: null,
      isDemo: true,
      createdAt: now,
      updatedAt: now,
      events: [
        {
          id: "later",
          tradingPlanId: "plan-1",
          eventType: "activated",
          eventTime: later,
          price: null,
          description: "later",
          source: "system",
          metadata: "{}",
          createdAt: later,
        },
        {
          id: "earlier",
          tradingPlanId: "plan-1",
          eventType: "created",
          eventTime: now,
          price: null,
          description: "earlier",
          source: "system",
          metadata: "{}",
          createdAt: now,
        },
      ],
      review: null,
      snapshot: null,
    } as never);

    expect(plan.reasons).toEqual(["reason"]);
    expect(plan.warnings).toEqual(["warning"]);
    expect(plan.events.map((event) => event.id)).toEqual(["earlier", "later"]);
  });
});
