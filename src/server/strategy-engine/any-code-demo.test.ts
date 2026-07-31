import { describe, expect, it } from "vitest";
import { MockMarketDataProvider } from "../market-data/mock-market-data-provider";
import { buildIntegrityReport } from "../data-integrity/validators/integrity-report-builder";
import { runAllStrategies } from "./strategy-engine";
import type { StrategyInput, StrategySectorSnapshot } from "./types/strategy";

describe("strategy engine: any code in demo mode", () => {
  it("观察池之外的代码也能生成演示策略计划", async () => {
    const provider = new MockMarketDataProvider();
    const code = "000001";
    const quote = await provider.getQuote(code);
    const dailyBars = await provider.getDailyBars(code, {});
    const minuteBars = await provider.getMinuteBars(code, { period: "1m", limit: 240 });
    const sectors = await provider.getSectorSnapshots();
    const overview = await provider.getMarketOverview();
    const sectorSnapshots: StrategySectorSnapshot[] = sectors.map((sector) => ({
      sectorId: sector.id,
      sectorName: sector.name,
      tradingDate: sector.marketTimestamp.slice(0, 10),
      strengthScore: sector.strengthScore,
      dataStatus: sector.status,
      source: sector.source,
    }));
    const integrityReport = buildIntegrityReport({
      code,
      mode: "mock",
      quote,
      dailyBars,
      minuteBars,
      sectors,
      marketOverview: overview,
    });
    const input: StrategyInput = {
      code,
      name: quote.name,
      sectorIds: [],
      analysisTradingDate: integrityReport.latestTradingDate,
      quote,
      dailyBars,
      minuteBars,
      sectorSnapshots,
      marketOverview: overview
        ? {
            tradingDate: overview.marketTimestamp.slice(0, 10),
            marketScore: overview.marketScore,
            dataStatus: overview.status,
            source: overview.source,
          }
        : null,
      integrityReport,
      previousSignals: [],
      previousTradePlans: [],
      strategyVersion: "test",
      calculatedAt: integrityReport.validatedAt,
    };

    const output = runAllStrategies(input);
    expect(dailyBars.length).toBeGreaterThanOrEqual(250);
    expect(output.finalPlan.isDemoPlan).toBe(true);
    expect(output.finalPlan.currentAction).not.toBe("data_blocked");
  });
});
