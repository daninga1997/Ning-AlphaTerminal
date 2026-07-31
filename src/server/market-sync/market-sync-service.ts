import type { MinuteBarPeriod, StockQuote } from "../../types/market-data";
import type { MarketDataStatus } from "../../types/market-data";
import { MarketDataError, assertAllowedStockCode } from "../market-data/market-data-errors";
import type { MarketDataProvider } from "../market-data/market-data-provider";
import { getProvider } from "../market-data/provider-registry";
import type { MarketDataRepository, MarketStorageDataType } from "../market-storage/market-data-repository";
import { PrismaMarketDataRepository } from "../market-storage/prisma-market-data-repository";
import { toStoredDailyBar, toStoredMarketOverview, toStoredMinuteBar, toStoredQuoteSnapshot } from "../market-storage/market-data-mappers";
import { coreSectorMappings, watchlistCodes } from "./sector-mapping";
import { scoreCoreSector } from "./market-sector-scoring";
import { buildMarketOverviewFromQuotes } from "./market-overview-scoring";
import { trendSwingConfig } from "../strategy-engine/config/trend-swing-config";

export type SyncSummary = {
  dataType: MarketStorageDataType;
  success: boolean;
  provider: string;
  strategyUsed: string | null;
  requestedCodes: string[];
  recordCount: number;
  missingCodes: string[];
  errorCode: string | null;
  durationMs: number;
  usedStaleCache: boolean;
  status: MarketDataStatus;
};

export type SyncDailyOptions = {
  codes?: string[];
  adjustment?: "none" | "qfq" | "hfq";
  start?: string;
  end?: string;
  force?: boolean;
};

export type SyncMinuteOptions = {
  codes?: string[];
  period?: MinuteBarPeriod;
  tradingDate?: string;
  start?: string;
  end?: string;
  force?: boolean;
};

const MIN_DAILY_BARS_FOR_STRATEGY = trendSwingConfig.minDailyBars;

function defaultStartForDaily(): string {
  const start = new Date();
  start.setDate(start.getDate() - 420);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(start);
}

function normalizeCodes(codes?: string[]): string[] {
  const normalized = codes?.length ? codes : watchlistCodes;
  normalized.forEach(assertAllowedStockCode);
  return normalized;
}

function errorCodeOf(error: unknown): string {
  return error instanceof MarketDataError ? error.code : "MARKET_SYNC_ERROR";
}

export class MarketSyncService {
  constructor(
    private readonly provider: MarketDataProvider = getProvider(),
    private readonly repository: MarketDataRepository = new PrismaMarketDataRepository(),
  ) {}

  async syncQuotes(codesInput?: string[]): Promise<SyncSummary> {
    const codes = normalizeCodes(codesInput);
    const startedAt = new Date();
    try {
      const quotes = await this.provider.getQuotes(codes);
      const realQuotes = quotes.filter((quote) => !quote.isDemo);
      const count = await this.repository.saveQuoteSnapshots(realQuotes.map((quote) => toStoredQuoteSnapshot(quote, new Date())));
      const missingCodes = codes.filter((code) => !quotes.some((quote) => quote.code === code));
      const summary = this.summary("quotes", startedAt, true, codes, count, missingCodes, null, false, quotes[0]?.strategyUsed ?? null, quotes[0]?.status ?? "delayed");
      await this.saveRun(summary, startedAt);
      return summary;
    } catch (error) {
      const summary = this.summary("quotes", startedAt, false, codes, 0, codes, errorCodeOf(error), false, null, "unavailable");
      await this.saveRun(summary, startedAt);
      return summary;
    }
  }

  async syncDailyBars(options: SyncDailyOptions = {}): Promise<SyncSummary> {
    const codes = normalizeCodes(options.codes);
    const startedAt = new Date();
    const adjustment = options.adjustment ?? "qfq";
    let recordCount = 0;
    const missingCodes: string[] = [];
    let errorCode: string | null = null;
    try {
      for (const code of codes) {
        try {
          const existing = await this.repository.getDailyBars({ code, adjustment, limit: 260 });
          const needsFetch = options.force || existing.length < MIN_DAILY_BARS_FOR_STRATEGY;
          if (!needsFetch) continue;
          const bars = await this.provider.getDailyBars(code, {
            adjust: adjustment,
            start: options.start ?? defaultStartForDaily(),
            end: options.end,
          });
          const stored = bars.slice(-300).map((bar) => toStoredDailyBar(bar, adjustment, new Date()));
          recordCount += await this.repository.upsertDailyBars(stored);
          if (stored.length < MIN_DAILY_BARS_FOR_STRATEGY) missingCodes.push(code);
        } catch (error) {
          errorCode = errorCodeOf(error);
          missingCodes.push(code);
        }
      }
      const status = missingCodes.length ? (recordCount > 0 ? "partial" : "unavailable") : "delayed";
      const summary = this.summary("daily_bars", startedAt, recordCount > 0 || missingCodes.length < codes.length, codes, recordCount, missingCodes, errorCode, false, adjustment, status);
      await this.saveRun(summary, startedAt);
      return summary;
    } catch (error) {
      const summary = this.summary("daily_bars", startedAt, false, codes, recordCount, missingCodes.length ? missingCodes : codes, errorCodeOf(error), recordCount > 0, adjustment, recordCount > 0 ? "stale" : "unavailable");
      await this.saveRun(summary, startedAt);
      return summary;
    }
  }

  async syncMinuteBars(options: SyncMinuteOptions = {}): Promise<SyncSummary> {
    const codes = normalizeCodes(options.codes);
    const period = options.period ?? "1m";
    const startedAt = new Date();
    let recordCount = 0;
    const missingCodes: string[] = [];
    let errorCode: string | null = null;
    try {
      for (const code of codes) {
        try {
          const bars = await this.provider.getMinuteBars(code, {
            period,
            startTime: options.start,
            endTime: options.end,
            limit: 500,
          });
          const barsToStore = bars;
          recordCount += await this.repository.upsertMinuteBars(barsToStore.map((bar) => toStoredMinuteBar(bar, period, new Date())));
          if (barsToStore.length === 0) missingCodes.push(code);
        } catch (error) {
          errorCode = errorCodeOf(error);
          missingCodes.push(code);
        }
      }
      const status = missingCodes.length ? (recordCount > 0 ? "partial" : "unavailable") : "delayed";
      const summary = this.summary("minute_bars", startedAt, recordCount > 0 || missingCodes.length < codes.length, codes, recordCount, missingCodes, errorCode, false, period, status);
      await this.saveRun(summary, startedAt);
      return summary;
    } catch (error) {
      const summary = this.summary("minute_bars", startedAt, false, codes, recordCount, missingCodes.length ? missingCodes : codes, errorCodeOf(error), recordCount > 0, period, recordCount > 0 ? "stale" : "unavailable");
      await this.saveRun(summary, startedAt);
      return summary;
    }
  }

  async syncSectors(codesInput?: string[]): Promise<SyncSummary> {
    const codes = normalizeCodes(codesInput);
    const startedAt = new Date();
    try {
      const quotes = await this.provider.getQuotes(codes);
      const results = coreSectorMappings.map((mapping) => scoreCoreSector(mapping, quotes, new Date()));
      const count = await this.repository.saveSectorSnapshots(results.map((result) => result.snapshot));
      const partial = results.some((result) => result.isPartial);
      const summary = this.summary("sectors", startedAt, true, codes, count, [], null, false, "akshare_quote_sector_proxy", partial ? "partial" : "delayed");
      await this.saveRun(summary, startedAt);
      return summary;
    } catch (error) {
      const summary = this.summary("sectors", startedAt, false, codes, 0, codes, errorCodeOf(error), false, "akshare_quote_sector_proxy", "unavailable");
      await this.saveRun(summary, startedAt);
      return summary;
    }
  }

  async syncMarketOverview(codesInput?: string[]): Promise<SyncSummary> {
    const codes = normalizeCodes(codesInput);
    const startedAt = new Date();
    try {
      const quotes: StockQuote[] = await this.provider.getQuotes(codes);
      const overview = buildMarketOverviewFromQuotes(quotes, new Date());
      await this.repository.saveMarketOverview(toStoredMarketOverview(overview, new Date()));
      const summary = this.summary("market_overview", startedAt, true, codes, 1, [], null, false, "akshare_quote_market_proxy", "partial");
      await this.saveRun(summary, startedAt);
      return summary;
    } catch (error) {
      const summary = this.summary("market_overview", startedAt, false, codes, 0, codes, errorCodeOf(error), false, "akshare_quote_market_proxy", "unavailable");
      await this.saveRun(summary, startedAt);
      return summary;
    }
  }

  async finalizeTradingDay(now = new Date()): Promise<{ success: boolean; summaries: SyncSummary[]; refusedReason: string | null }> {
    const shanghaiTime = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(now);
    const weekday = shanghaiTime.find((part) => part.type === "weekday")?.value;
    const hour = Number(shanghaiTime.find((part) => part.type === "hour")?.value ?? 0);
    const minute = Number(shanghaiTime.find((part) => part.type === "minute")?.value ?? 0);
    if (weekday === "Sat" || weekday === "Sun") return { success: false, summaries: [], refusedReason: "非交易日不执行收盘固化" };
    if (hour * 60 + minute < 15 * 60 + 5) return { success: false, summaries: [], refusedReason: "15:05前拒绝收盘固化" };
    const summaries = [
      await this.syncQuotes(),
      await this.syncDailyBars({ force: true }),
      await this.syncMinuteBars({ period: "1m" }),
      await this.syncSectors(),
      await this.syncMarketOverview(),
    ];
    const success = summaries.some((summary) => summary.success);
    await this.saveRun(this.summary("finalize_day", now, success, watchlistCodes, summaries.reduce((sum, item) => sum + item.recordCount, 0), summaries.flatMap((item) => item.missingCodes), success ? null : "FINALIZE_DAY_FAILED", summaries.some((item) => item.usedStaleCache), "finalize", summaries.every((item) => item.success) ? "delayed" : "partial"), now);
    return { success, summaries, refusedReason: null };
  }

  private summary(
    dataType: MarketStorageDataType,
    startedAt: Date,
    success: boolean,
    requestedCodes: string[],
    recordCount: number,
    missingCodes: string[],
    errorCode: string | null,
    usedStaleCache: boolean,
    strategyUsed: string | null,
    status: SyncSummary["status"],
  ): SyncSummary {
    return {
      dataType,
      success,
      provider: this.provider.source,
      strategyUsed,
      requestedCodes,
      recordCount,
      missingCodes,
      errorCode,
      durationMs: Date.now() - startedAt.getTime(),
      usedStaleCache,
      status,
    };
  }

  private async saveRun(summary: SyncSummary, startedAt: Date): Promise<void> {
    try {
      await this.repository.saveFetchRun({
        dataType: summary.dataType,
        requestedCodesJson: JSON.stringify(summary.requestedCodes),
        provider: summary.provider,
        strategyUsed: summary.strategyUsed,
        startedAt,
        completedAt: new Date(),
        success: summary.success,
        recordCount: summary.recordCount,
        missingCodesJson: JSON.stringify(summary.missingCodes),
        errorCode: summary.errorCode,
        durationMs: summary.durationMs,
        usedStaleCache: summary.usedStaleCache,
      });
    } catch {
      // Logging must not block market data fetches.
    }
  }
}
