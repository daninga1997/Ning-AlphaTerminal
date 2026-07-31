import { mockStocks } from "@/data/mock-stocks";
import type { DataIntegrityReport } from "@/types/data-integrity";
import type { MarketDailyBar, MarketOverview, MinuteBar, SectorSnapshot, StockQuote } from "@/types/market-data";
import { buildIntegrityReport } from "@/server/data-integrity/validators/integrity-report-builder";
import { MarketDataService } from "@/server/market-data/market-data-service";
import { getMarketDataMode } from "@/server/market-data/provider-registry";
import { fromStoredDailyBar, fromStoredMinuteBar } from "@/server/market-storage/market-data-mappers";
import type {
  MarketDataRepository,
  StoredMarketOverviewSnapshot,
  StoredSectorDailySnapshot,
  StoredStockQuoteSnapshot,
} from "@/server/market-storage/market-data-repository";
import { PrismaMarketDataRepository } from "@/server/market-storage/prisma-market-data-repository";
import { coreSectorMappings, watchlistCodes } from "@/server/market-sync/sector-mapping";
import { getExpectedIntradayTradingDate, getLatestExpectedTradingDate } from "@/server/trading-calendar/trading-day-resolver";
import type { StrategyInput, StrategySectorSnapshot } from "./types/strategy";
import { StrategyEngineError } from "./strategy-errors";
import { selectCompletedDailyBars } from "./completed-daily-bars";
import { selectTradingDayMinuteBars } from "./current-minute-bars";

export interface StrategyInputBuilderOptions {
  quoteOverride?: StockQuote | null;
  sectorsOverride?: SectorSnapshot[] | null;
  marketOverviewOverride?: MarketOverview | null;
  service?: MarketDataService;
  repository?: MarketDataRepository;
  skipProviderHistorical?: boolean;
}

export async function buildStrategyInputForCode(code: string, options: StrategyInputBuilderOptions = {}): Promise<StrategyInput> {
  if (!watchlistCodes.includes(code)) {
    throw new StrategyEngineError("STOCK_NOT_IN_WATCHLIST", "股票不在20只核心观察池中", 404);
  }

  const stock = mockStocks.find((item) => item.code === code);
  if (!stock) throw new StrategyEngineError("STOCK_NOT_FOUND", "股票不存在", 404);

  const mode = getMarketDataMode();
  const service = options.service ?? new MarketDataService();
  const repository = options.repository ?? new PrismaMarketDataRepository();
  const quote = "quoteOverride" in options ? options.quoteOverride ?? null : await loadQuote(code, service, repository);
  const rawDailyBars = await loadDailyBars(code, service, repository, options.skipProviderHistorical ?? false);
  const dailyBars = selectCompletedDailyBars(rawDailyBars, getLatestExpectedTradingDate(new Date()));
  const minuteBars = await loadMinuteBars(
    code,
    service,
    repository,
    options.skipProviderHistorical ?? false,
    getExpectedIntradayTradingDate(new Date()),
  );
  const sectors = "sectorsOverride" in options ? options.sectorsOverride ?? [] : await loadSectors(service, repository);
  const marketOverview = "marketOverviewOverride" in options ? options.marketOverviewOverride ?? null : await loadMarketOverview(service, repository);
  const integrityReport = buildIntegrityReport({
    code,
    mode,
    quote,
    dailyBars,
    minuteBars,
    sectors,
    marketOverview,
  });

  return {
    code,
    name: stock.name,
    sectorIds: sectorIdsOf(code),
    analysisTradingDate: integrityReport.latestTradingDate,
    quote,
    dailyBars,
    minuteBars,
    sectorSnapshots: sectors.map(toStrategySectorSnapshot),
    marketOverview: marketOverview ? {
      tradingDate: marketOverview.marketTimestamp.slice(0, 10),
      marketScore: marketOverview.marketScore,
      dataStatus: marketOverview.status,
      source: marketOverview.source,
    } : null,
    integrityReport,
    previousSignals: [],
    previousTradePlans: [],
    strategyVersion: "alpha-strategy-engine-v1",
    calculatedAt: integrityReport.validatedAt,
  };
}

async function loadQuote(code: string, service: MarketDataService, repository: MarketDataRepository): Promise<StockQuote | null> {
  const result = await service.getQuote(code);
  if (result.success) return result.data;
  const stored = await repository.getLatestQuoteSnapshot(code);
  return stored ? quoteFromStored(stored) : null;
}

async function loadDailyBars(code: string, service: MarketDataService, repository: MarketDataRepository, skipProviderHistorical: boolean): Promise<MarketDailyBar[]> {
  const stored = await repository.getDailyBars({ code, adjustment: "qfq", limit: 300 });
  if (stored.length > 0) return stored.map(fromStoredDailyBar);
  if (skipProviderHistorical && getMarketDataMode() === "live") return [];
  const result = await service.getDailyBars(code);
  if (result.success) return result.data;
  return stored.map(fromStoredDailyBar);
}

async function loadMinuteBars(
  code: string,
  service: MarketDataService,
  repository: MarketDataRepository,
  skipProviderHistorical: boolean,
  tradingDate: string,
): Promise<MinuteBar[]> {
  const stored = await repository.getMinuteBars({ code, period: "1m", tradingDate, limit: 240 });
  if (stored.length > 0) return selectTradingDayMinuteBars(stored.map(fromStoredMinuteBar), tradingDate);
  if (skipProviderHistorical && getMarketDataMode() === "live") return [];
  const result = await service.getMinuteBars(code, { period: "1m", limit: 240 });
  if (result.success) return selectTradingDayMinuteBars(result.data, tradingDate);
  return selectTradingDayMinuteBars(stored.map(fromStoredMinuteBar), tradingDate);
}

async function loadSectors(service: MarketDataService, repository: MarketDataRepository): Promise<SectorSnapshot[]> {
  const result = await service.getSectorSnapshots();
  if (result.success) return result.data;
  const stored = await repository.getSectorSnapshots();
  return stored.map(sectorFromStored);
}

async function loadMarketOverview(service: MarketDataService, repository: MarketDataRepository): Promise<MarketOverview | null> {
  const result = await service.getMarketOverview();
  if (result.success) return result.data;
  const stored = await repository.getLatestMarketOverview();
  return stored ? overviewFromStored(stored) : null;
}

export async function loadStrategySharedMarketContext(service: MarketDataService, repository: MarketDataRepository) {
  const [sectors, marketOverview] = await Promise.all([
    loadSectors(service, repository),
    loadMarketOverview(service, repository),
  ]);
  return { sectors, marketOverview };
}

function sectorIdsOf(code: string): string[] {
  return coreSectorMappings.filter((mapping) => mapping.codes.includes(code)).map((mapping) => mapping.sectorId);
}

function quoteFromStored(quote: StoredStockQuoteSnapshot): StockQuote {
  return {
    code: quote.code,
    name: mockStocks.find((stock) => stock.code === quote.code)?.name ?? quote.code,
    exchange: "SZSE",
    price: quote.price,
    previousClose: quote.previousClose,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    change: quote.change,
    changePercent: quote.changePercent,
    volume: quote.volume,
    amount: quote.amount,
    turnoverRate: quote.turnoverRate,
    volumeRatio: quote.volumeRatio,
    bidPrice: quote.price,
    askPrice: quote.price,
    marketTimestamp: quote.marketTimestamp.toISOString(),
    receivedAt: quote.fetchedAt.toISOString(),
    status: quote.dataStatus,
    source: quote.source,
    isDemo: false,
    strategyUsed: quote.strategyUsed,
  };
}

function sectorFromStored(sector: StoredSectorDailySnapshot): SectorSnapshot {
  return {
    id: sector.sectorId,
    name: sector.sectorName,
    changePercent: sector.changePercent,
    leadingStocks: JSON.parse(sector.leadingStocksJson) as string[],
    strengthScore: sector.strengthScore,
    marketTimestamp: `${sector.tradingDate}T15:00:00+08:00`,
    receivedAt: sector.fetchedAt.toISOString(),
    status: sector.dataStatus === "partial" ? "partial" : sector.dataStatus,
    source: sector.source,
    isDemo: false,
  };
}

function overviewFromStored(overview: StoredMarketOverviewSnapshot): MarketOverview {
  return {
    tradingSession: "closed",
    marketTimestamp: overview.marketTimestamp.toISOString(),
    receivedAt: overview.fetchedAt.toISOString(),
    status: overview.dataStatus === "partial" ? "partial" : overview.dataStatus,
    totalAmount: overview.totalAmount,
    advancingCount: overview.advancingCount,
    decliningCount: overview.decliningCount,
    unchangedCount: overview.unchangedCount,
    limitUpCount: overview.limitUpCount,
    limitDownCount: overview.limitDownCount,
    marketScore: overview.marketScore,
    source: overview.source,
    isDemo: false,
  };
}

function toStrategySectorSnapshot(sector: SectorSnapshot): StrategySectorSnapshot {
  return {
    sectorId: sector.id,
    sectorName: sector.name,
    tradingDate: sector.marketTimestamp.slice(0, 10),
    strengthScore: sector.strengthScore,
    dataStatus: sector.status,
    source: sector.source,
    breakdown: [
      { name: "板块涨跌幅", rawValue: sector.changePercent, score: Math.max(0, Math.min(20, 10 + sector.changePercent)), maxScore: 20, source: sector.source, missingReason: null },
      { name: "板块强度", rawValue: sector.strengthScore, score: Math.round(sector.strengthScore * 0.8), maxScore: 80, source: sector.source, missingReason: null },
    ],
  };
}

export function summarizeIntegrity(report: DataIntegrityReport) {
  return {
    status: report.status,
    permission: report.permission,
    completenessPercent: report.completenessPercent,
    issues: report.issues.map((issue) => ({ code: issue.code, message: issue.message })),
    warnings: report.warnings.map((issue) => ({ code: issue.code, message: issue.message })),
  };
}
