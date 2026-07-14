import { describe, expect, it } from "vitest";
import { buildTradingPlanWhere, tradingPlanInclude, tradingPlanOrderBy } from "./trading-plan-query-builder";

describe("trading plan query builder", () => {
  it("builds the default non-archived query", () => {
    expect(buildTradingPlanWhere()).toEqual({ archivedAt: null });
    expect(tradingPlanInclude).toEqual({ events: true, review: true, snapshot: true });
    expect(tradingPlanOrderBy).toEqual([{ createdAt: "desc" }]);
  });

  it("builds filters without changing repository semantics", () => {
    expect(
      buildTradingPlanWhere({
        date: "2026-07-14",
        sector: "机器人",
        planType: "short_term",
        status: "active",
        marketDataMode: "mock",
        query: "双环",
        reviewed: "yes",
        outcome: "first_target",
      }),
    ).toEqual({
      archivedAt: null,
      planDate: "2026-07-14",
      sector: "机器人",
      planType: "short_term",
      status: "active",
      marketDataMode: "mock",
      OR: [
        { code: { contains: "双环" } },
        { name: { contains: "双环" } },
        { sector: { contains: "双环" } },
      ],
      review: { is: { outcome: "first_target" } },
    });
  });
});
