import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateCompleteness } from "./completeness-calculator";
import { resolveDataIntegrityStatus } from "./integrity-status-resolver";
import { checkSourceConsistency } from "./source-consistency";
import { resolveTradeDecisionPermission, canGenerateAction } from "./permission-matrix";
import { buildIntegrityReport } from "./validators/integrity-report-builder";
import type { MarketDailyBar, MarketOverview, MinuteBar, SectorSnapshot, StockQuote } from "../../types/market-data";
import type { DataIntegrityReport, StrategyType } from "../../types/data-integrity";

afterEach(() => vi.useRealTimers());

function dailyBars(): MarketDailyBar[] {
  const start = new Date("2026-03-31T00:00:00Z");
  return Array.from({ length: 120 }, (_, index) => {
    const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return {
      code: "002472", date, open: 10, high: 11, low: 9, close: 10.5, previousClose: 10,
      volume: 1000, amount: 10500, turnoverRate: 1, source: "tencent", isDemo: false,
    };
  });
}

function minuteBars(): MinuteBar[] {
  return Array.from({ length: 30 }, (_, index) => {
    const totalMinutes = 10 * 60 + 35 + index;
    const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const minute = String(totalMinutes % 60).padStart(2, "0");
    return {
      code: "002472", timestamp: `2026-07-29T${hour}:${minute}:00+08:00`, open: 10, high: 11,
      low: 9, close: 10.5, volume: 1000, amount: 10500, averagePrice: 10.5, previousClose: 10,
      source: "tencent", receivedAt: "2026-07-29T11:05:00+08:00", status: "fresh", isDemo: false,
    };
  });
}

function quote(): StockQuote {
  return {
    code: "002472", name: "双环传动", exchange: "SZSE", price: 10.5, previousClose: 10,
    open: 10, high: 11, low: 9, change: 0.5, changePercent: 5, volume: 1000, amount: 10500,
    turnoverRate: 1, volumeRatio: 1, bidPrice: 10.5, askPrice: 10.5,
    marketTimestamp: "2026-07-29T11:05:00+08:00", receivedAt: "2026-07-29T11:05:00+08:00",
    status: "fresh", source: "tencent", isDemo: false,
  };
}

function sector(): SectorSnapshot {
  return {
    id: "robotics", name: "机器人", changePercent: 1, leadingStocks: ["002472"], strengthScore: 70,
    marketTimestamp: "2026-07-29T11:05:00+08:00", receivedAt: "2026-07-29T11:05:00+08:00",
    status: "fresh", source: "tencent", isDemo: false,
  };
}

function overview(): MarketOverview {
  return {
    tradingSession: "morning", marketTimestamp: "2026-07-29T11:05:00+08:00",
    receivedAt: "2026-07-29T11:05:00+08:00", status: "fresh", totalAmount: 1,
    advancingCount: 1, decliningCount: 1, unchangedCount: 0, limitUpCount: 0, limitDownCount: 0,
    marketScore: 70, source: "tencent", isDemo: false,
  };
}

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

  it("Replay和Live混用被阻断", () => {
    const result = checkSourceConsistency({
      quote: { source: "akshare", mode: "live", isDemo: false },
      daily: { source: "replay", mode: "replay", isDemo: false },
      minute: null,
    });
    expect(result.isConsistent).toBe(false);
  });

  it("不同Live源组合通过(带警告)", () => {
    const result = checkSourceConsistency({
      quote: { source: "akshare_sina", mode: "live", isDemo: false },
      daily: { source: "akshare_eastmoney", mode: "live", isDemo: false },
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

describe("盘中完整性校验", () => {
  it("接受当日报价和分钟线，同时要求上一交易日的完整日线", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T03:05:00Z"));

    const report = buildIntegrityReport({
      code: "002472", mode: "live", quote: quote(), dailyBars: dailyBars(), minuteBars: minuteBars(),
      sectors: [sector()], marketOverview: overview(),
    });

    expect(report.issues.some((issue) => issue.code === "WRONG_TRADING_DATE")).toBe(false);
    expect(report.completenessPercent).toBe(100);
    expect(report.permission).toBe("full");
  });
});
