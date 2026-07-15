import { describe, it, expect } from "vitest";
import { calculateCompleteness } from "./completeness-calculator";
import { resolveDataIntegrityStatus } from "./integrity-status-resolver";
import { checkSourceConsistency } from "./source-consistency";
import { resolveTradeDecisionPermission, canGenerateAction } from "./permission-matrix";
import type { DataIntegrityReport, StrategyType } from "../../types/data-integrity";

describe("Completeness Calculator", () => {
  it("完整数据计算为85以上", () => {
    const score = calculateCompleteness({
      hasValidQuote: true,
      hasValidDailyBars: true,
      hasValidMinuteBars: true,
      hasValidSector: true,
      hasValidMarketOverview: true,
      isSourceConsistent: true,
      criticalIssues: [],
    });
    expect(score).toBe(100);
  });

  it("缺分钟线时得80", () => {
    const score = calculateCompleteness({
      hasValidQuote: true,
      hasValidDailyBars: true,
      hasValidMinuteBars: false,
      hasValidSector: true,
      hasValidMarketOverview: true,
      isSourceConsistent: true,
      criticalIssues: [],
    });
    expect(score).toBe(80);
  });

  it("MOCK_LIVE_MIXED直接返回0", () => {
    const score = calculateCompleteness({
      hasValidQuote: true,
      hasValidDailyBars: true,
      hasValidMinuteBars: true,
      hasValidSector: true,
      hasValidMarketOverview: true,
      isSourceConsistent: true,
      criticalIssues: ["MOCK_LIVE_MIXED"],
    });
    expect(score).toBe(0);
  });

  it("WRONG_TRADING_DATE直接返回0", () => {
    const score = calculateCompleteness({
      hasValidQuote: true,
      hasValidDailyBars: true,
      hasValidMinuteBars: true,
      hasValidSector: true,
      hasValidMarketOverview: true,
      isSourceConsistent: true,
      criticalIssues: ["WRONG_TRADING_DATE"],
    });
    expect(score).toBe(0);
  });
});

describe("Integrity Status Resolver", () => {
  it("mock模式返回demo_only", () => {
    const status = resolveDataIntegrityStatus({
      completenessPercent: 100,
      quoteValid: true,
      dailyValid: true,
      minuteValid: true,
      sourceConsistent: true,
      hasCriticalIssues: false,
      mode: "mock",
    });
    expect(status).toBe("demo_only");
  });

  it("完整数据返回complete", () => {
    const status = resolveDataIntegrityStatus({
      completenessPercent: 100,
      quoteValid: true,
      dailyValid: true,
      minuteValid: true,
      sourceConsistent: true,
      hasCriticalIssues: false,
      mode: "live",
    });
    expect(status).toBe("complete");
  });
});

describe("Source Consistency", () => {
  it("Mock和Live混用被阻断", () => {
    const result = checkSourceConsistency({
      quote: { source: "mock", mode: "mock", isDemo: true },
      daily: { source: "akshare", mode: "live", isDemo: false },
      minute: null,
    });
    expect(result.isConsistent).toBe(false);
  });

  it("纯Live源通过", () => {
    const result = checkSourceConsistency({
      quote: { source: "akshare", mode: "live", isDemo: false },
      daily: { source: "akshare", mode: "live", isDemo: false },
      minute: null,
    });
    expect(result.isConsistent).toBe(true);
  });
});

describe("Permission Matrix", () => {
  function makeReport(overrides: Partial<DataIntegrityReport>): DataIntegrityReport {
    return {
      code: "002896",
      requestedAt: new Date().toISOString(),
      latestTradingDate: "2026-07-15",
      quoteTradingDate: "2026-07-15",
      dailyBarsLatestDate: "2026-07-15",
      minuteBarsLatestDate: null,
      marketTimestamp: "2026-07-15T10:00:00+08:00",
      receivedAt: new Date().toISOString(),
      quoteSource: "akshare",
      dailySource: "akshare",
      minuteSource: null,
      marketDataMode: "live",
      status: "complete",
      permission: "full",
      completenessPercent: 100,
      issues: [],
      warnings: [],
      validatedAt: new Date().toISOString(),
      canGenerateScore: true,
      canGenerateWatchZone: true,
      canGenerateEntryPrice: true,
      canGenerateBuySignal: true,
      canGenerateTradePlan: true,
      ...overrides,
    };
  }

  it("permission=full允许完整交易计划", () => {
    const report = makeReport({ completenessPercent: 100 });
    const perm = resolveTradeDecisionPermission(report, "trend_swing");
    expect(perm).toBe("full");
  });

  it("watch_only不能生成精确买入价", () => {
    expect(canGenerateAction("watch_only", "entry_price")).toBe(false);
  });

  it("blocked不能生成评分", () => {
    expect(canGenerateAction("blocked", "score")).toBe(false);
  });

  it("尾盘策略缺分钟数据时非full", () => {
    const report = makeReport({
      completenessPercent: 65,
      minuteBarsLatestDate: null,
    });
    const perm = resolveTradeDecisionPermission(report, "late_session_momentum");
    expect(perm).not.toBe("full");
    expect(perm).toBe("watch_only");
  });

  it("MOCK_LIVE_MIXED直接blocked", () => {
    const report = makeReport({
      issues: [{ code: "MOCK_LIVE_MIXED", message: "test", isCritical: true }],
    });
    const perm = resolveTradeDecisionPermission(report, "generic_short_term");
    expect(perm).toBe("blocked");
  });
});