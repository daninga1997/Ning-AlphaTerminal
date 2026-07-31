import { describe, expect, it } from "vitest";
import { buildCapabilityMatrix, getCapabilityBadgeText } from "./capability-matrix";

describe("market data capability matrix", () => {
  it("shows quote availability separately from minute availability", () => {
    const matrix = buildCapabilityMatrix({
      mode: "live",
      providerName: "tencent",
      health: {
        ok: true,
        source: "tencent",
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
        dailyBarsLastFailureAt: "2026-07-14T18:02:27+08:00",
        minuteBarsLastFailureAt: "2026-07-14T18:02:27+08:00",
      },
      quoteMeta: {
        source: "tencent",
        status: "delayed",
        marketTimestamp: "2026-07-14T18:02:41+08:00",
        receivedAt: "2026-07-14T18:02:41+08:00",
        isDemo: false,
        mode: "live",
        isReplay: false,
        delayedSeconds: 0,
        strategyUsed: "sina_spot",
        upstreamErrorCode: null,
      },
    });

    expect(matrix.quotes.currentStatus).toBe("delayed");
    expect(matrix.quotes.strategyUsed).toBe("sina_spot");
    expect(matrix.quotes.source).toBe("腾讯财经");
    expect(matrix.dailyBars.currentStatus).toBe("unavailable");
    expect(matrix.minuteBars.currentStatus).toBe("unavailable");
    expect(getCapabilityBadgeText(matrix)).toBe("腾讯财经 · 报价可用 · 分钟线不可用");
  });

  it("does not label unsupported sectors and market overview as available", () => {
    const matrix = buildCapabilityMatrix({
      mode: "live",
      providerName: "tencent",
      health: {
        ok: true,
        source: "tencent",
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
