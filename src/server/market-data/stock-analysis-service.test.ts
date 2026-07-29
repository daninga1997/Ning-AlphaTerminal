import { describe, expect, it } from "vitest";
import type { DailyBarOptions } from "./market-data-provider";
import { MarketDataService } from "./market-data-service";
import { MockMarketDataProvider } from "./mock-market-data-provider";
import { getStockDetailFromMarketData } from "./stock-analysis-service";
import { MarketDataError } from "./market-data-errors";

class CountingProvider extends MockMarketDataProvider {
  readonly requestedDailyCodes: string[] = [];

  override async getDailyBars(code: string, options: DailyBarOptions = {}) {
    this.requestedDailyCodes.push(code);
    return super.getDailyBars(code, options);
  }
}

describe("stock detail market data loading", () => {
  it("loads daily bars once for a single stock detail request", async () => {
    const provider = new CountingProvider();
    const service = new MarketDataService({ provider, cacheTtlMs: 0 });

    const detail = await getStockDetailFromMarketData("002472", service);

    expect(detail?.stock.code).toBe("002472");
    expect(detail?.bars.length).toBeGreaterThan(0);
    expect(provider.requestedDailyCodes).toEqual(["002472"]);
  });

  it("requests daily bars for the new code when the stock detail code changes", async () => {
    const provider = new CountingProvider();
    const service = new MarketDataService({ provider, cacheTtlMs: 0 });

    await getStockDetailFromMarketData("002472", service);
    await getStockDetailFromMarketData("002317", service);

    expect(provider.requestedDailyCodes).toEqual(["002472", "002317"]);
  });

  it("uses real quote but blocks new buy when daily technical data is unavailable", async () => {
    const provider = new CountingProvider();
    provider.getQuote = async () => ({
      ...(await new MockMarketDataProvider().getQuote("002472")),
      status: "delayed",
      source: "AKShare stock_zh_a_spot",
      isDemo: false,
      strategyUsed: "sina_spot",
    });
    provider.getDailyBars = async () => {
      throw new MarketDataError("UPSTREAM_UNAVAILABLE", "daily unavailable");
    };
    const service = new MarketDataService({ provider, cacheTtlMs: 0 });

    const detail = await getStockDetailFromMarketData("002472", service);

    expect(detail?.stock.currentPrice).toBeGreaterThan(0);
    expect(detail?.stock.marketDataMeta.status).toBe("delayed");
    expect(detail?.stock.technicalDataMeta.status).toBe("unavailable");
    expect(detail?.stock.signal).not.toBe("buy");
    expect(detail?.stock.shortTermScore.warnings).toContain("仅报价可用，技术确认不足。");
  });

  it("blocks new buy when daily technical data is delayed", async () => {
    const provider = new CountingProvider();
    provider.getQuote = async () => ({
      ...(await new MockMarketDataProvider().getQuote("002472")),
      status: "closed",
      source: "tencent",
      isDemo: false,
    });
    provider.getDailyBars = async (code, options) => {
      const bars = await new MockMarketDataProvider().getDailyBars(code, options);
      return bars.map((bar) => ({ ...bar, status: "delayed" as const }));
    };
    const service = new MarketDataService({ provider, cacheTtlMs: 0 });

    const detail = await getStockDetailFromMarketData("002472", service);

    expect(detail?.stock.technicalDataMeta.status).toBe("delayed");
    expect(detail?.stock.dataCapabilityWarning).toBe("仅报价可用，技术确认不足。");
    expect(detail?.stock.signal).not.toBe("buy");
  });
});
