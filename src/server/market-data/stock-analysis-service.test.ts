import { describe, expect, it } from "vitest";
import type { DailyBarOptions } from "./market-data-provider";
import { MarketDataService } from "./market-data-service";
import { MockMarketDataProvider } from "./mock-market-data-provider";
import { getStockDetailFromMarketData } from "./stock-analysis-service";

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
});
