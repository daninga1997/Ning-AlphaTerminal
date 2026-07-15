import type { MarketDataStatus, MinuteBarPeriod } from "../../types/market-data";

export type MarketBarAdjustment = "none" | "qfq" | "hfq";
export type MarketStorageDataType = "quotes" | "daily_bars" | "minute_bars" | "sectors" | "market_overview" | "finalize_day";

export interface StoredDailyMarketBar {
  id?: string;
  code: string;
  tradingDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  previousClose: number;
  volume: number;
  amount: number;
  turnoverRate: number;
  adjustment: MarketBarAdjustment;
  source: string;
  fetchedAt: Date;
  marketTimestamp: Date | null;
  dataStatus: MarketDataStatus;
  checksum?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StoredMinuteMarketBar {
  id?: string;
  code: string;
  tradingDate: string;
  timestamp: Date;
  period: MinuteBarPeriod;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
  averagePrice: number;
  source: string;
  fetchedAt: Date;
  dataStatus: MarketDataStatus | "partial";
  checksum?: string;
  createdAt?: Date;
}

export interface StoredStockQuoteSnapshot {
  id?: string;
  code: string;
  tradingDate: string;
  marketTimestamp: Date;
  price: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  change: number;
  changePercent: number;
  volume: number;
  amount: number;
  turnoverRate: number;
  volumeRatio: number;
  source: string;
  strategyUsed: string | null;
  dataStatus: MarketDataStatus;
  fetchedAt: Date;
  createdAt?: Date;
}

export interface StoredSectorDailySnapshot {
  id?: string;
  sectorId: string;
  sectorName: string;
  tradingDate: string;
  changePercent: number;
  advancingCount: number;
  decliningCount: number;
  unchangedCount: number;
  limitUpCount: number;
  totalAmount: number;
  strengthScore: number;
  leadingStocksJson: string;
  source: string;
  fetchedAt: Date;
  dataStatus: MarketDataStatus | "partial";
  createdAt?: Date;
}

export interface StoredMarketOverviewSnapshot {
  id?: string;
  tradingDate: string;
  marketTimestamp: Date;
  totalAmount: number;
  advancingCount: number;
  decliningCount: number;
  unchangedCount: number;
  limitUpCount: number;
  limitDownCount: number;
  marketScore: number;
  source: string;
  fetchedAt: Date;
  dataStatus: MarketDataStatus | "partial";
  createdAt?: Date;
}

export interface StoredDataFetchRun {
  id?: string;
  dataType: MarketStorageDataType;
  requestedCodesJson: string;
  provider: string;
  strategyUsed: string | null;
  startedAt: Date;
  completedAt: Date | null;
  success: boolean;
  recordCount: number;
  missingCodesJson: string;
  errorCode: string | null;
  durationMs: number;
  usedStaleCache: boolean;
  createdAt?: Date;
}

export interface FetchHealthSummary {
  dataType: MarketStorageDataType;
  totalRuns24h: number;
  successfulRuns24h: number;
  successRate24h: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
}

export interface MarketCoverageSummary {
  quotes: { latestTradingDate: string | null; codeCount: number; lastSuccessAt: Date | null };
  dailyBars: { latestTradingDate: string | null; codeCount: number; coverageDays: number; lastSuccessAt: Date | null };
  minuteBars: { latestMinuteTimestamp: Date | null; codeCount: number; completenessPercent: number; lastSuccessAt: Date | null };
  sectors: { latestTradingDate: string | null; sectorCount: number; lastSuccessAt: Date | null };
  marketOverview: { latestTradingDate: string | null; lastSuccessAt: Date | null };
}

export interface MarketDataRepository {
  upsertDailyBars(bars: StoredDailyMarketBar[]): Promise<number>;
  getDailyBars(input: { code: string; adjustment: MarketBarAdjustment; source?: string; from?: string; to?: string; limit?: number }): Promise<StoredDailyMarketBar[]>;
  upsertMinuteBars(bars: StoredMinuteMarketBar[]): Promise<number>;
  getMinuteBars(input: { code: string; period: MinuteBarPeriod; tradingDate?: string; from?: Date; to?: Date; source?: string; limit?: number }): Promise<StoredMinuteMarketBar[]>;
  saveQuoteSnapshots(quotes: StoredStockQuoteSnapshot[]): Promise<number>;
  getLatestQuoteSnapshot(code: string): Promise<StoredStockQuoteSnapshot | null>;
  saveSectorSnapshots(sectors: StoredSectorDailySnapshot[]): Promise<number>;
  getSectorSnapshots(input?: { tradingDate?: string; source?: string }): Promise<StoredSectorDailySnapshot[]>;
  saveMarketOverview(snapshot: StoredMarketOverviewSnapshot): Promise<StoredMarketOverviewSnapshot>;
  getLatestMarketOverview(source?: string): Promise<StoredMarketOverviewSnapshot | null>;
  saveFetchRun(run: StoredDataFetchRun): Promise<StoredDataFetchRun>;
  getFetchHealthSummary(dataType?: MarketStorageDataType): Promise<FetchHealthSummary[]>;
  getCoverageSummary(codes: string[]): Promise<MarketCoverageSummary>;
}
