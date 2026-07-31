import { describe, expect, it } from "vitest";
import { analyzeAllStocks } from "../../lib/stock-analysis";
import type { StockQuote } from "../../types/market-data";
import { applyQuoteRefreshFailure, mergeQuoteRefreshResult } from "./watchlist-quotes-model";

function quote(overrides: Partial<StockQuote>): StockQuote {
  return {
    code: "002472",
    name: "双环传动",
    exchange: "SZSE",
    price: 42.39,
    previousClose: 40,
    open: 41,
    high: 43,
    low: 40.5,
    change: 2.39,
    changePercent: 5.98,
    volume: 100000,
    amount: 4239000,
    turnoverRate: 1.2,
    volumeRatio: 1.1,
    bidPrice: 42.39,
    askPrice: 42.4,
    marketTimestamp: "2026-07-14T15:30:01+08:00",
    receivedAt: "2026-07-14T18:02:41+08:00",
    status: "delayed",
    source: "tencent",
    isDemo: false,
    strategyUsed: "sina_spot",
    ...overrides,
  };
}

describe("watchlist quote model", () => {
  it("merges real quote price and marks sina source", () => {
    const stocks = analyzeAllStocks();
    const merged = mergeQuoteRefreshResult(stocks, {
      data: [quote({})],
      meta: {
        source: "tencent",
        status: "delayed",
        marketTimestamp: "2026-07-14T15:30:01+08:00",
        receivedAt: "2026-07-14T18:02:41+08:00",
        isDemo: false,
        mode: "live",
        strategyUsed: "sina_spot",
      },
    });

    const stock = merged.find((item) => item.code === "002472")!;
    expect(stock.currentPrice).toBe(42.39);
    expect(stock.changePercent).toBe(5.98);
    expect(stock.marketDataMeta?.source).toBe("tencent");
    expect(stock.marketDataMeta?.strategyUsed).toBe("sina_spot");
  });

  it("keeps last prices and marks stale when refresh fails after a quote exists", () => {
    const stocks = mergeQuoteRefreshResult(analyzeAllStocks(), {
      data: [quote({})],
      meta: {
        source: "tencent",
        status: "delayed",
        marketTimestamp: "2026-07-14T15:30:01+08:00",
        receivedAt: "2026-07-14T18:02:41+08:00",
        isDemo: false,
        mode: "live",
        strategyUsed: "sina_spot",
      },
    });

    const failed = applyQuoteRefreshFailure(stocks);
    const stock = failed.find((item) => item.code === "002472")!;
    expect(stock.currentPrice).toBe(42.39);
    expect(stock.marketDataMeta?.status).toBe("stale");
  });

  it("marks quotes unavailable when there is no real cache", () => {
    const failed = applyQuoteRefreshFailure(analyzeAllStocks());
    expect(failed[0]?.marketDataMeta?.status).toBe("unavailable");
    expect(failed[0]?.currentPrice).not.toBe(0);
  });
});
