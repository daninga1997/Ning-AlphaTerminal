import type { MarketDailyBar, MinuteBar, SectorSnapshot, StockQuote, MarketOverview } from "../../types/market-data";
import type {
  MarketBarAdjustment,
  StoredDailyMarketBar,
  StoredMarketOverviewSnapshot,
  StoredMinuteMarketBar,
  StoredSectorDailySnapshot,
  StoredStockQuoteSnapshot,
} from "./market-data-repository";
import { marketDataChecksum } from "./market-data-checksum";
import { assertFiniteMarketNumber, assertValidStockCode } from "./market-data-errors";

function assertFiniteFields(value: Record<string, unknown>, fields: string[]): void {
  fields.forEach((field) => assertFiniteMarketNumber(value[field] as number, field));
}

export function toStoredDailyBar(bar: MarketDailyBar, adjustment: MarketBarAdjustment, fetchedAt = new Date()): StoredDailyMarketBar {
  assertValidStockCode(bar.code);
  assertFiniteFields(bar as unknown as Record<string, unknown>, ["open", "high", "low", "close", "previousClose", "volume", "amount", "turnoverRate"]);
  const stored = {
    code: bar.code,
    tradingDate: bar.date,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    previousClose: bar.previousClose,
    volume: bar.volume,
    amount: bar.amount,
    turnoverRate: bar.turnoverRate,
    adjustment,
    source: bar.source,
    fetchedAt,
    marketTimestamp: new Date(`${bar.date}T15:00:00+08:00`),
    dataStatus: bar.isDemo ? "unavailable" : "delayed",
  } satisfies Omit<StoredDailyMarketBar, "checksum">;
  return { ...stored, checksum: marketDataChecksum(stored) };
}

export function fromStoredDailyBar(bar: StoredDailyMarketBar): MarketDailyBar {
  return {
    code: bar.code,
    date: bar.tradingDate,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    previousClose: bar.previousClose,
    volume: bar.volume,
    amount: bar.amount,
    turnoverRate: bar.turnoverRate,
    source: bar.source,
    isDemo: false,
  };
}

export function toStoredMinuteBar(bar: MinuteBar, period: StoredMinuteMarketBar["period"], fetchedAt = new Date()): StoredMinuteMarketBar {
  assertValidStockCode(bar.code);
  assertFiniteFields(bar as unknown as Record<string, unknown>, ["open", "high", "low", "close", "volume", "amount", "averagePrice"]);
  const timestamp = new Date(bar.timestamp);
  const tradingDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(timestamp);
  const stored = {
    code: bar.code,
    tradingDate,
    timestamp,
    period,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    amount: bar.amount,
    averagePrice: bar.averagePrice,
    source: bar.source,
    fetchedAt,
    dataStatus: bar.status,
  } satisfies Omit<StoredMinuteMarketBar, "checksum">;
  return { ...stored, checksum: marketDataChecksum(stored) };
}

export function fromStoredMinuteBar(bar: StoredMinuteMarketBar): MinuteBar {
  return {
    code: bar.code,
    timestamp: bar.timestamp.toISOString(),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    amount: bar.amount,
    averagePrice: bar.averagePrice,
    previousClose: bar.open,
    source: bar.source,
    receivedAt: bar.fetchedAt.toISOString(),
    status: bar.dataStatus === "partial" ? "partial" : "stale",
    isDemo: false,
    isReplay: false,
  };
}

export function toStoredQuoteSnapshot(quote: StockQuote, fetchedAt = new Date()): StoredStockQuoteSnapshot {
  assertValidStockCode(quote.code);
  assertFiniteFields(quote as unknown as Record<string, unknown>, [
    "price",
    "previousClose",
    "open",
    "high",
    "low",
    "change",
    "changePercent",
    "volume",
    "amount",
  ]);
  const marketTimestamp = new Date(quote.marketTimestamp);
  const tradingDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(marketTimestamp);
  return {
    code: quote.code,
    tradingDate,
    marketTimestamp,
    price: quote.price,
    previousClose: quote.previousClose,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    change: quote.change,
    changePercent: quote.changePercent,
    volume: quote.volume,
    amount: quote.amount,
    turnoverRate: quote.turnoverRate ?? 0,
    volumeRatio: quote.volumeRatio ?? 0,
    source: quote.source,
    strategyUsed: quote.strategyUsed ?? null,
    dataStatus: quote.status,
    fetchedAt,
  };
}

export function toStoredSectorSnapshot(sector: SectorSnapshot, fetchedAt = new Date()): StoredSectorDailySnapshot {
  assertFiniteFields(sector as unknown as Record<string, unknown>, ["changePercent", "strengthScore", "totalAmount"]);
  const marketTimestamp = new Date(sector.marketTimestamp);
  return {
    sectorId: sector.id,
    sectorName: sector.name,
    tradingDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(marketTimestamp),
    changePercent: sector.changePercent,
    advancingCount: 0,
    decliningCount: 0,
    unchangedCount: 0,
    limitUpCount: 0,
    totalAmount: 0,
    strengthScore: sector.strengthScore,
    leadingStocksJson: JSON.stringify(sector.leadingStocks),
    source: sector.source,
    fetchedAt,
    dataStatus: sector.status,
  };
}

export function toStoredMarketOverview(overview: MarketOverview, fetchedAt = new Date()): StoredMarketOverviewSnapshot {
  assertFiniteFields(overview as unknown as Record<string, unknown>, ["totalAmount", "marketScore"]);
  const marketTimestamp = new Date(overview.marketTimestamp);
  return {
    tradingDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(marketTimestamp),
    marketTimestamp,
    totalAmount: overview.totalAmount,
    advancingCount: overview.advancingCount,
    decliningCount: overview.decliningCount,
    unchangedCount: overview.unchangedCount,
    limitUpCount: overview.limitUpCount,
    limitDownCount: overview.limitDownCount,
    marketScore: overview.marketScore,
    source: overview.source,
    fetchedAt,
    dataStatus: overview.status,
  };
}
