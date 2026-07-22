import { expect, it } from "vitest";
import { getResearchStockDetail } from "./research-stock-service";

it("returns a non-core stock as research-only data", async () => {
  const service = {
    getQuote: async () => ({
      success: true as const,
      data: {
        code: "002594",
        name: "比亚迪",
        exchange: "SZSE" as const,
        price: 100,
        previousClose: 99,
        open: 99,
        high: 101,
        low: 98,
        change: 1,
        changePercent: 1.01,
        volume: 1,
        amount: 100,
        turnoverRate: 0,
        volumeRatio: 0,
        bidPrice: 100,
        askPrice: 100,
        marketTimestamp: "2026-07-22T15:00:00+08:00",
        receivedAt: "2026-07-22T15:00:00+08:00",
        status: "closed" as const,
        source: "tencent",
        isDemo: false,
      },
      meta: {
        source: "tencent",
        status: "closed" as const,
        marketTimestamp: "2026-07-22T15:00:00+08:00",
        receivedAt: "2026-07-22T15:00:00+08:00",
        isDemo: false,
      },
    }),
    getDailyBars: async () => ({
      success: true as const,
      data: [],
      meta: {
        source: "tencent",
        status: "unavailable" as const,
        marketTimestamp: null,
        receivedAt: "2026-07-22T15:00:00+08:00",
        isDemo: false,
      },
    }),
  };

  const detail = await getResearchStockDetail("002594", service);

  expect(detail?.isCoreWatchlist).toBe(false);
  expect(detail?.quote.code).toBe("002594");
  expect("shortTermScore" in (detail ?? {})).toBe(false);
});

it("does not resolve an unsupported stock code", async () => {
  const service = {
    getQuote: async () => {
      throw new Error("should not be called");
    },
    getDailyBars: async () => {
      throw new Error("should not be called");
    },
  };

  await expect(getResearchStockDetail("300750", service)).resolves.toBeNull();
});
