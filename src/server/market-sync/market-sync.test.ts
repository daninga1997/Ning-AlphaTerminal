import { describe, expect, it, vi } from "vitest";
import type { MarketDataProvider, ProviderHealth } from "../market-data/market-data-provider";
import type { MarketDataRepository, StoredDailyMarketBar, StoredDataFetchRun, StoredMarketOverviewSnapshot, StoredMinuteMarketBar, StoredSectorDailySnapshot, StoredStockQuoteSnapshot } from "../market-storage/market-data-repository";
import type { MarketDailyBar, MarketOverview, MinuteBar, SectorSnapshot, StockQuote } from "../../types/market-data";
import { aggregateMinuteBars, calculateMinuteCompleteness, isContinuousAuctionMinute } from "./minute-bars-tools";
import { scoreCoreSector } from "./market-sector-scoring";
import { coreSectorMappings } from "./sector-mapping";
import { buildMarketOverviewFromQuotes, suggestedPositionUpperBound } from "./market-overview-scoring";
import { MarketSyncService } from "./market-sync-service";

function quote(code: string, changePercent = 1): StockQuote {
  return {
    code,
    name: code,
    exchange: "SZSE",
    price: 10,
    previousClose: 9.9,
    open: 9.9,
    high: 10.2,
    low: 9.8,
    change: 0.1,
    changePercent,
    volume: 100,
    amount: 1000,
    turnoverRate: 1,
    volumeRatio: 1,
    bidPrice: 10,
    askPrice: 10,
    marketTimestamp: "2026-07-14T15:00:00+08:00",
    receivedAt: "2026-07-14T15:00:01+08:00",
    status: "delayed",
    source: "AKShare stock_zh_a_spot",
    isDemo: false,
    strategyUsed: "sina_spot",
  };
}

class FakeProvider implements MarketDataProvider {
  readonly source = "akshare";
  readonly mode = "live" as const;
  getQuotes = vi.fn(async (codes: string[]) => codes.map((code) => quote(code)));
  getQuote = vi.fn(async (code: string) => quote(code));
  getDailyBars = vi.fn(async (code: string): Promise<MarketDailyBar[]> => [
    { code, date: "2026-07-14", open: 1, high: 2, low: 1, close: 2, previousClose: 1, volume: 100, amount: 200, turnoverRate: 1, source: "AKShare stock_zh_a_hist", isDemo: false },
  ]);
  getMinuteBars = vi.fn(async (code: string): Promise<MinuteBar[]> => [
    { code, timestamp: "2026-07-14T14:56:00+08:00", open: 1, high: 2, low: 1, close: 2, volume: 100, amount: 200, averagePrice: 2, previousClose: 1, source: "AKShare stock_zh_a_hist_min_em", receivedAt: "2026-07-14T15:00:00+08:00", status: "delayed", isDemo: false },
  ]);
  getSectorSnapshots = vi.fn(async (): Promise<SectorSnapshot[]> => []);
  getMarketOverview = vi.fn(async (): Promise<MarketOverview> => buildMarketOverviewFromQuotes([quote("002472")]));
  healthCheck = vi.fn(async (): Promise<ProviderHealth> => ({
    ok: true,
    source: "akshare",
    mode: "live",
    capabilities: { supportsQuotes: true, supportsDailyBars: true, supportsMinuteBars: true, supportsSectors: false, supportsMarketOverview: false, minimumRefreshIntervalMs: 60_000, supportedMinutePeriods: ["1m"], isLicensedSource: false },
  }));
}

class FakeRepository implements MarketDataRepository {
  daily: StoredDailyMarketBar[] = [];
  minutes: StoredMinuteMarketBar[] = [];
  quotes: StoredStockQuoteSnapshot[] = [];
  sectors: StoredSectorDailySnapshot[] = [];
  overviews: StoredMarketOverviewSnapshot[] = [];
  runs: StoredDataFetchRun[] = [];
  existingDailyCount = 0;
  async upsertDailyBars(bars: StoredDailyMarketBar[]) { this.daily.push(...bars); return bars.length; }
  async getDailyBars() { return Array.from({ length: this.existingDailyCount }, (_, index) => ({ code: "002472", tradingDate: `2026-01-${String(index + 1).padStart(2, "0")}`, adjustment: "qfq", source: "test", open: 1, high: 1, low: 1, close: 1, previousClose: 1, volume: 1, amount: 1, turnoverRate: 1, fetchedAt: new Date(), marketTimestamp: null, dataStatus: "delayed", checksum: "x" } as StoredDailyMarketBar)); }
  async upsertMinuteBars(bars: StoredMinuteMarketBar[]) { this.minutes.push(...bars); return bars.length; }
  async getMinuteBars() { return []; }
  async saveQuoteSnapshots(quotes: StoredStockQuoteSnapshot[]) { this.quotes.push(...quotes); return quotes.length; }
  async getLatestQuoteSnapshot() { return this.quotes.at(-1) ?? null; }
  async saveSectorSnapshots(sectors: StoredSectorDailySnapshot[]) { this.sectors.push(...sectors); return sectors.length; }
  async getSectorSnapshots() { return this.sectors; }
  async saveMarketOverview(snapshot: StoredMarketOverviewSnapshot) { this.overviews.push(snapshot); return snapshot; }
  async getLatestMarketOverview() { return this.overviews.at(-1) ?? null; }
  async saveFetchRun(run: StoredDataFetchRun) { this.runs.push(run); return run; }
  async getFetchHealthSummary() { return []; }
  async getCoverageSummary() { return { quotes: { latestTradingDate: null, codeCount: 0, lastSuccessAt: null }, dailyBars: { latestTradingDate: null, codeCount: 0, coverageDays: 0, lastSuccessAt: null }, minuteBars: { latestMinuteTimestamp: null, codeCount: 0, completenessPercent: 0, lastSuccessAt: null }, sectors: { latestTradingDate: null, sectorCount: 0, lastSuccessAt: null }, marketOverview: { latestTradingDate: null, lastSuccessAt: null } }; }
}

describe("market sync stabilization", () => {
  it("does not generate lunch-break fake minute bars", () => {
    expect(isContinuousAuctionMinute(new Date("2026-07-14T11:45:00+08:00"))).toBe(false);
  });

  it("aggregates 1m bars into 5m without reverse-inferring 1m", () => {
    const bars = Array.from({ length: 5 }, (_, index) => ({
      ...quote("002472"),
      timestamp: `2026-07-14T10:0${index}:00+08:00`,
      open: 1,
      high: 2 + index,
      low: 1,
      close: 2,
      volume: 10,
      amount: 20,
      averagePrice: 2,
      previousClose: 1,
      receivedAt: "2026-07-14T10:00:00+08:00",
      isReplay: false,
    })) as MinuteBar[];
    const aggregated = aggregateMinuteBars(bars, "5m");
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].volume).toBe(50);
  });

  it("keeps tail strategy limited when minute completeness is low", () => {
    expect(calculateMinuteCompleteness([], 60)).toBe(0);
    expect(calculateMinuteCompleteness([], 60)).toBeLessThan(80);
  });

  it("marks sector score partial when mapped constituents are missing", () => {
    const result = scoreCoreSector(coreSectorMappings[0], [quote("002317")]);
    expect(result.isPartial).toBe(true);
    expect(result.snapshot.dataStatus).toBe("partial");
  });

  it("caps suggested position at 20% when market overview is incomplete", () => {
    const overview = buildMarketOverviewFromQuotes([quote("002472", 3), quote("002317", 2)]);
    expect(overview.status).toBe("partial");
    expect(suggestedPositionUpperBound(overview.marketScore, false)).toBe("0%-20%");
  });

  it("sync quotes stores real quote snapshots and fetch run", async () => {
    const repo = new FakeRepository();
    const summary = await new MarketSyncService(new FakeProvider(), repo).syncQuotes(["002472"]);
    expect(summary.success).toBe(true);
    expect(repo.quotes).toHaveLength(1);
    expect(repo.runs[0].dataType).toBe("quotes");
  });

  it("daily sync skips upstream when local qfq coverage is already sufficient", async () => {
    const repo = new FakeRepository();
    repo.existingDailyCount = 250;
    const provider = new FakeProvider();
    const summary = await new MarketSyncService(provider, repo).syncDailyBars({ codes: ["002472"] });
    expect(summary.success).toBe(true);
    expect(provider.getDailyBars).not.toHaveBeenCalled();
  });

  it("finalizeTradingDay is refused before 15:05", async () => {
    const result = await new MarketSyncService(new FakeProvider(), new FakeRepository()).finalizeTradingDay(new Date("2026-07-14T14:59:00+08:00"));
    expect(result.success).toBe(false);
    expect(result.refusedReason).toContain("15:05");
  });
});
