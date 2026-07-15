import { describe, it, expect } from "vitest";
import { buildMarketTimeLock } from "./market-time-lock";

describe("Market Time Lock", () => {
  it("盘中交易时段应使用前一个交易日日线", () => {
    const lock = buildMarketTimeLock({
      now: new Date("2026-07-15T02:00:00Z"), // 10:00 CST 盘中
      quoteTimestamp: "2026-07-15T10:00:00+08:00",
      dailyBarsLatestDate: "2026-07-14",
      minuteBarsLatestTimestamp: null,
      providerReceivedAt: "2026-07-15T10:00:00+08:00",
      dataMode: "live",
    });
    expect(lock.expectedDailyBarsDate).toBe("2026-07-14");
    expect(lock.canUseTodayDailyBars).toBe(false);
    expect(lock.isWithinTradingHours).toBe(true);
  });

  it("收盘后应使用当日的完整日线", () => {
    const lock = buildMarketTimeLock({
      now: new Date("2026-07-15T08:00:00Z"), // 16:00 CST 收盘后
      quoteTimestamp: "2026-07-15T15:00:00+08:00",
      dailyBarsLatestDate: "2026-07-15",
      minuteBarsLatestTimestamp: null,
      providerReceivedAt: "2026-07-15T15:00:00+08:00",
      dataMode: "live",
    });
    expect(lock.expectedDailyBarsDate).toBe("2026-07-15");
    expect(lock.canUseTodayDailyBars).toBe(true);
    expect(lock.isPostMarket).toBe(true);
  });

  it("非交易日时应返回前一个交易日", () => {
    const lock = buildMarketTimeLock({
      now: new Date("2026-07-19T02:00:00Z"), // Sunday
      quoteTimestamp: null,
      dailyBarsLatestDate: "2026-07-17",
      minuteBarsLatestTimestamp: null,
      providerReceivedAt: null,
      dataMode: "live",
    });
    expect(lock.latestExpectedTradingDate).toBe("2026-07-17");
  });

  it("mock模式下也正确设置日线日期", () => {
    const lock = buildMarketTimeLock({
      now: new Date("2026-07-15T02:00:00Z"),
      quoteTimestamp: null,
      dailyBarsLatestDate: null,
      minuteBarsLatestTimestamp: null,
      providerReceivedAt: null,
      dataMode: "mock",
    });
    expect(lock.expectedDailyBarsDate).toBe("2026-07-14");
    expect(lock.isWithinTradingHours).toBe(true);
  });

  it("报价时间提取正确", () => {
    const lock = buildMarketTimeLock({
      now: new Date("2026-07-15T02:00:00Z"),
      quoteTimestamp: "2026-07-15T10:30:45+08:00",
      dailyBarsLatestDate: "2026-07-14",
      minuteBarsLatestTimestamp: null,
      providerReceivedAt: "2026-07-15T10:30:50+08:00",
      dataMode: "live",
    });
    expect(lock.quoteDate).toBe("2026-07-15");
  });
});