import { describe, expect, it } from "vitest";
import { buildCapabilityMatrix, getCapabilityBadgeText } from "./capability-matrix";

describe("market data capability matrix", () => {
  it("shows quote availability separately from minute availability", () => {
    const matrix = buildCapabilityMatrix({
      mode: "live",
      providerName: "akshare",
      health: {
        ok: true,
        source: "akshare",
        mode: "live",
        capabilities: {
          supportsQuotes: true,
          supportsDailyBars: true,
          supportsMinuteBars: true,
          supportsSectors: false,
          supportsMarketOverview: false,
          minimumRefreshIntervalMs: 60_000,
          supportedMinutePeriods: ["1m", "5m"],
          isLicensedSource: false,
        },
        quoteLastSuccessAt: "2026-07-14T18:02:41+08:00",
        quoteCircuitState: "closed",
        quoteStrategyUsed: "sina_spot",
        dailyBarsLastFailureAt: "2026-07-14T18:02:27+08:00",
        minuteBarsLastFailureAt: "2026-07-14T18:02:27+08:00",
      },
    });

    expect(matrix.quotes.currentStatus).toBe("delayed");
    expect(matrix.quotes.strategyUsed).toBe("sina_spot");
    expect(matrix.quotes.source).toBe("AKShare / 新浪公开报价");
    expect(matrix.dailyBars.currentStatus).toBe("unavailable");
    expect(matrix.minuteBars.currentStatus).toBe("unavailable");
    expect(getCapabilityBadgeText(matrix)).toBe("AKShare · 报价可用 · 分钟线不可用");
  });

  it("does not label unsupported sectors and market overview as available", () => {
    const matrix = buildCapabilityMatrix({
      mode: "live",
      providerName: "akshare",
      health: {
        ok: true,
        source: "akshare",
        mode: "live",
        capabilities: {
          supportsQuotes: true,
          supportsDailyBars: true,
          supportsMinuteBars: true,
          supportsSectors: false,
          supportsMarketOverview: false,
          minimumRefreshIntervalMs: 60_000,
          supportedMinutePeriods: ["1m"],
          isLicensedSource: false,
        },
      },
    });

    expect(matrix.sectors.supported).toBe(false);
    expect(matrix.sectors.currentStatus).toBe("unavailable");
    expect(matrix.marketOverview.supported).toBe(false);
  });
});
