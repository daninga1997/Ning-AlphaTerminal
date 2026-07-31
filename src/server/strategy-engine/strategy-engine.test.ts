import { describe, expect, it } from "vitest";
import type { MarketDailyBar, MinuteBar, StockQuote } from "@/types/market-data";
import type { DataIntegrityReport } from "@/types/data-integrity";
import { runAllStrategies } from "./strategy-engine";
import { detectStrategyConflicts, generateAlphaTradePlan } from "./trade-plan-generator";
import { calculateWatchZone } from "./trade-levels/watch-zone-model";
import { buildEntryPlans } from "./trade-levels/entry-price-model";
import { calculateStopLoss } from "./trade-levels/stop-loss-model";
import { calculateTargets } from "./trade-levels/target-model";
import { calculateSuggestedPosition } from "./trade-levels/position-model";

function makeDailyBars(count = 260, options: { firstYin?: boolean; weakTrend?: boolean } = {}): MarketDailyBar[] {
  const bars: MarketDailyBar[] = [];
  for (let index = 0; index < count; index += 1) {
    const date = new Date(Date.UTC(2025, 9, 1 + index)).toISOString().slice(0, 10);
    const base = options.weakTrend ? 90 - index * 0.05 : 20 + index * 0.18;
    const isLaunch = options.firstYin && index === count - 3;
    const isFirstYin = options.firstYin && index === count - 2;
    const isRepair = options.firstYin && index === count - 1;
    const open = isLaunch ? base : isFirstYin ? base * 1.11 : base;
    const close = isLaunch ? base * 1.1 : isFirstYin ? base * 1.06 : isRepair ? base * 1.08 : base * 1.01;
    const high = Math.max(open, close) * 1.01;
    const low = Math.min(open, close) * 0.99;
    bars.push({
      code: "002472",
      date,
      open,
      high,
      low,
      close,
      previousClose: bars.at(-1)?.close ?? open,
      volume: isLaunch ? 2_000_000 : isFirstYin ? 1_500_000 : 1_000_000 + index * 1000,
      amount: (isLaunch ? 2_000_000 : 1_000_000) * close,
      turnoverRate: isLaunch ? 9 : 7,
      source: "test",
      isDemo: false,
    });
  }
  return bars;
}

function makeMinuteBars(): MinuteBar[] {
  return Array.from({ length: 60 }, (_, index) => {
    const hour = index < 30 ? 14 : 14;
    const minute = index < 30 ? index : 30 + (index - 30);
    return {
      code: "002472",
      timestamp: `2026-07-14T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`,
      open: 42 + index * 0.01,
      high: 42.2 + index * 0.01,
      low: 41.9 + index * 0.01,
      close: 42.05 + index * 0.015,
      volume: index >= 30 ? 30_000 : 10_000,
      amount: index >= 30 ? 1_260_000 : 420_000,
      averagePrice: 42,
      previousClose: 41,
      source: "test-minute",
      receivedAt: "2026-07-14T15:00:00+08:00",
      status: "delayed",
      isDemo: false,
    };
  });
}

function integrity(permission: DataIntegrityReport["permission"] = "full", status: DataIntegrityReport["status"] = "complete"): DataIntegrityReport {
  return {
    code: "002472",
    requestedAt: "2026-07-14T15:00:00+08:00",
    latestTradingDate: "2026-07-14",
    quoteTradingDate: "2026-07-14",
    dailyBarsLatestDate: "2026-07-14",
    minuteBarsLatestDate: "2026-07-14T14:55:00+08:00",
    marketTimestamp: "2026-07-14T15:00:00+08:00",
    receivedAt: "2026-07-14T15:00:01+08:00",
    quoteSource: "test",
    dailySource: "test",
    minuteSource: "test-minute",
    marketDataMode: "live",
    status,
    permission,
    completenessPercent: permission === "full" ? 95 : 60,
    issues: [],
    warnings: [],
    validatedAt: "2026-07-14T15:00:02+08:00",
    canGenerateScore: permission !== "blocked",
    canGenerateWatchZone: permission !== "blocked",
    canGenerateEntryPrice: permission === "full",
    canGenerateBuySignal: permission === "full",
    canGenerateTradePlan: permission === "full",
  };
}

function input(overrides: Partial<Parameters<typeof runAllStrategies>[0]> = {}) {
  const dailyBars = makeDailyBars(260, { firstYin: true });
  const quote: StockQuote = {
    code: "002472",
    name: "双环传动",
    exchange: "SZSE",
    price: dailyBars.at(-1)!.close,
    previousClose: dailyBars.at(-2)!.close,
    open: dailyBars.at(-1)!.open,
    high: dailyBars.at(-1)!.high,
    low: dailyBars.at(-1)!.low,
    change: 1,
    changePercent: 3.2,
    volume: 2_000_000,
    amount: 90_000_000,
    turnoverRate: 8,
    volumeRatio: 1.5,
    bidPrice: dailyBars.at(-1)!.close,
    askPrice: dailyBars.at(-1)!.close,
    marketTimestamp: "2026-07-14T15:00:00+08:00",
    receivedAt: "2026-07-14T15:00:01+08:00",
    status: "delayed",
    source: "test",
    isDemo: false,
  };
  return {
    code: "002472",
    name: "双环传动",
    sectorIds: ["robotics"],
    analysisTradingDate: "2026-07-14",
    quote,
    dailyBars,
    minuteBars: makeMinuteBars(),
    sectorSnapshots: [{ sectorId: "robotics", sectorName: "机器人", tradingDate: "2026-07-14", strengthScore: 82, dataStatus: "delayed", source: "test" }],
    marketOverview: { tradingDate: "2026-07-14", marketScore: 72, dataStatus: "delayed", source: "test" },
    integrityReport: integrity(),
    previousSignals: [],
    previousTradePlans: [],
    strategyVersion: "test-v1",
    calculatedAt: "2026-07-14T15:01:00+08:00",
    ...overrides,
  } satisfies Parameters<typeof runAllStrategies>[0];
}

describe("Alpha strategy engine V1", () => {
  it("returns deterministic results and does not buy when permission is not full", () => {
    const strategyInput = input({ integrityReport: integrity("watch_only", "partial") });
    const first = runAllStrategies(strategyInput);
    const second = runAllStrategies(strategyInput);
    expect(first).toEqual(second);
    expect(first.finalPlan.currentAction).not.toBe("buy_allowed");
    expect(first.finalPlan.suggestedPositionPercent).toBe(0);
  });

  it("calculates watch zone from clustered supports below chase limit", () => {
    const result = calculateWatchZone(input());
    expect(result.low).toBeLessThan(result.high);
    expect(result.supports.length).toBeGreaterThanOrEqual(3);
    expect(result.confidence).not.toBe("unavailable");
  });

  it("keeps first entry above second entry and stop below entry", () => {
    const strategyInput = input();
    const watchZone = calculateWatchZone(strategyInput);
    const entries = buildEntryPlans(strategyInput, watchZone, "trend_swing_v1");
    const stop = calculateStopLoss(strategyInput, entries[0], "trend_swing_v1");
    const targets = calculateTargets(strategyInput, entries[0], stop);
    expect(entries[0].low).toBeGreaterThan(entries[1].low);
    expect(stop.price).toBeLessThan(entries[0].low);
    expect(targets.firstTarget.price).toBeGreaterThan(entries[0].high);
    expect(targets.secondTarget.price).toBeGreaterThan(targets.firstTarget.price);
  });

  it("blocks buy when risk reward is below 1.2 or current price exceeds chase limit", () => {
    const baseInput = input();
    const highPriceInput = input({ quote: { ...baseInput.quote!, price: 999 } });
    const result = runAllStrategies(highPriceInput);
    expect(result.finalPlan.currentAction).not.toBe("buy_allowed");
    expect(result.finalPlan.invalidReasons.join(" ")).toContain("追高");
  });

  it("matches leader first yin only for valid first-yin repair structure", () => {
    const result = runAllStrategies(input());
    const leader = result.strategyResults.find((item) => item.strategyId === "leader_first_yin_v1")!;
    expect(leader.matched).toBe(true);
    const weak = runAllStrategies(input({ dailyBars: makeDailyBars(260, { weakTrend: true }) }));
    const weakLeader = weak.strategyResults.find((item) => item.strategyId === "leader_first_yin_v1")!;
    expect(weakLeader.matched).toBe(false);
  });

  it("late session strategy requires full minute data after 14:30", () => {
    const result = runAllStrategies(input({ minuteBars: [] }));
    const late = result.strategyResults.find((item) => item.strategyId === "late_session_momentum_v1")!;
    expect(late.matched).toBe(false);
    expect(late.invalidReasons.join(" ")).toContain("14:30");
  });

  it("trend swing scores higher when MA20 is above MA60 and drawdown is controlled", () => {
    const strong = runAllStrategies(input());
    const weak = runAllStrategies(input({ dailyBars: makeDailyBars(260, { weakTrend: true }) }));
    const strongTrend = strong.strategyResults.find((item) => item.strategyId === "trend_swing_v1")!;
    const weakTrend = weak.strategyResults.find((item) => item.strategyId === "trend_swing_v1")!;
    expect(strongTrend.totalScore).toBeGreaterThan(weakTrend.totalScore);
  });

  it("position model lowers position when ATR risk is high", () => {
    const lowRisk = calculateSuggestedPosition({ grade: "A", marketCap: 50, riskRewardRatio: 2, stopDistancePercent: 5, dataPermission: "full", marketPositionCap: 50 });
    const highRisk = calculateSuggestedPosition({ grade: "A", marketCap: 50, riskRewardRatio: 2, stopDistancePercent: 14, dataPermission: "full", marketPositionCap: 50 });
    expect(highRisk).toBeLessThan(lowRisk);
  });

  it("generates a final trade plan with explicit action, cancellation and exit rules", () => {
    const result = runAllStrategies(input());
    const plan = generateAlphaTradePlan(input(), result.strategyResults);
    expect(plan.currentAction).toMatch(/focus|wait_for_pullback|breakout_watch|buy_allowed/);
    expect(plan.cancellationConditions.length).toBeGreaterThan(0);
    expect(plan.exitRules.length).toBeGreaterThan(0);
    expect(plan.watchZone.low).toBeLessThan(plan.chaseLimit.price);
  });

  it("demo mode runs the full pipeline and marks plans as demo", () => {
    const strategyInput = input({ integrityReport: integrity("demo", "demo_only") });
    const result = runAllStrategies(strategyInput);
    expect(result.finalPlan.isDemoPlan).toBe(true);
    expect(result.finalPlan.currentAction).not.toBe("data_blocked");
    expect(result.strategyResults.every((item) => item.permission === "demo")).toBe(true);
  });

  it("each entry plan carries its own risk reward ratio", () => {
    const strategyInput = input();
    const result = runAllStrategies(strategyInput, { strategy: "trend_swing" });
    const ratios = result.finalPlan.entryPlans.map((entry) => entry.riskRewardRatio ?? 0);
    expect(result.finalPlan.entryPlans.length).toBeGreaterThan(1);
    expect(new Set(ratios).size).toBeGreaterThan(1);
  });

  it("does not treat an inapplicable avoid as a buy/avoid conflict", () => {
    const results = runAllStrategies(input()).strategyResults;
    const buyLike = { ...results[0], action: "buy_allowed" as const, invalidReasons: [] };
    const inapplicable = { ...results[1], action: "avoid" as const, invalidReasons: ["未形成合法首阴修复结构"] };
    const active = { ...results[1], action: "avoid" as const, invalidReasons: ["最大回撤过大"] };
    expect(detectStrategyConflicts([buyLike, inapplicable])).toEqual([]);
    expect(detectStrategyConflicts([buyLike, active])).toHaveLength(1);
  });
});
