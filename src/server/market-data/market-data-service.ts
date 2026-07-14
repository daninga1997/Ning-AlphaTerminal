import type {
  MarketDailyBar,
  MarketDataMeta,
  MarketDataResult,
  MarketOverview,
  MinuteBar,
  MinuteBarPeriod,
  SectorSnapshot,
  StockQuote,
} from "../../types/market-data";
import { getTradingSession } from "./trading-session";
import type { MarketDataProvider, MinuteBarOptions } from "./market-data-provider";
import { MarketDataCache } from "./market-data-cache";
import { assertAllowedStockCode, MarketDataError } from "./market-data-errors";
import { getProvider } from "./provider-registry";
import { getMinuteCacheTtlMs, getQuoteCacheTtlMs } from "./cache-policy";

function getCacheTtlMs(): number {
  return getQuoteCacheTtlMs(getTradingSession());
}

function metaFromData(
  data: StockQuote | MarketOverview | SectorSnapshot,
  mode?: MarketDataMeta["mode"],
): MarketDataMeta {
  return {
    source: data.source,
    status: data.status,
    marketTimestamp: data.marketTimestamp,
    receivedAt: data.receivedAt,
    isDemo: data.isDemo,
    mode,
    isReplay: mode === "replay",
    delayedSeconds: Math.max(0, Math.round((Date.now() - new Date(data.marketTimestamp).getTime()) / 1000)),
  };
}

function staleQuote(quote: StockQuote): StockQuote {
  return { ...quote, status: "stale" };
}

function staleMinuteBars(bars: MinuteBar[]): MinuteBar[] {
  return bars.map((bar) => ({ ...bar, status: "stale" as const }));
}

export class MarketDataService {
  private readonly provider: MarketDataProvider;
  private readonly cache = new MarketDataCache();
  private readonly cacheTtlMs?: number;

  constructor(options: { provider?: MarketDataProvider; cacheTtlMs?: number } = {}) {
    this.provider = options.provider ?? getProvider();
    this.cacheTtlMs = options.cacheTtlMs;
  }

  async getQuote(code: string): Promise<MarketDataResult<StockQuote>> {
    try {
      assertAllowedStockCode(code);
      const key = `quote:${code}`;
      const data = await this.cache.getOrLoad(key, this.cacheTtlMs ?? getCacheTtlMs(), () => this.provider.getQuote(code));
      return { success: true, data, meta: metaFromData(data, this.provider.mode) };
    } catch (error) {
      const key = `quote:${code}`;
      const fallback = this.cache.getLastSuccess<StockQuote>(key);
      if (fallback) {
        const data = staleQuote(fallback);
        return { success: true, data, meta: metaFromData(data) };
      }
      return this.failure(error);
    }
  }

  async getQuotes(codes: string[]): Promise<MarketDataResult<StockQuote[]>> {
    try {
      if (codes.length > 50) throw new MarketDataError("TOO_MANY_CODES", "单次查询股票数量过多", 400);
      codes.forEach(assertAllowedStockCode);
      const key = `quotes:${codes.join(",")}`;
      const data = await this.cache.getOrLoad(key, this.cacheTtlMs ?? getCacheTtlMs(), () => this.provider.getQuotes(codes));
      const first = data[0];
      return {
        success: true,
        data,
        meta: first
          ? metaFromData(first, this.provider.mode)
          : { source: this.provider.source, status: "unavailable", marketTimestamp: null, receivedAt: new Date().toISOString(), isDemo: this.provider.mode === "mock" },
      };
    } catch (error) {
      return this.failure(error);
    }
  }

  async getDailyBars(code: string): Promise<MarketDataResult<MarketDailyBar[]>> {
    try {
      assertAllowedStockCode(code);
      const key = `bars:${code}:120d`;
      const data = await this.cache.getOrLoad(key, this.cacheTtlMs ?? getCacheTtlMs(), () =>
        this.provider.getDailyBars(code, { period: "120d" }),
      );
      return {
        success: true,
        data,
        meta: {
          source: data[0]?.source ?? this.provider.source,
          status: data.length > 0 ? "fresh" : "unavailable",
          marketTimestamp: data.at(-1)?.date ?? null,
          receivedAt: new Date().toISOString(),
          isDemo: data[0]?.isDemo ?? this.provider.mode === "mock",
        },
      };
    } catch (error) {
      return this.failure(error);
    }
  }

  async getMinuteBars(code: string, options: MinuteBarOptions): Promise<MarketDataResult<MinuteBar[]>> {
    try {
      assertAllowedStockCode(code);
      const limit = options.limit ?? 120;
      if (limit < 1 || limit > 500) throw new MarketDataError("INVALID_LIMIT", "limit参数无效", 400);
      const period: MinuteBarPeriod = options.period;
      const key = `minutes:${code}:${period}:${options.startTime ?? ""}:${options.endTime ?? ""}:${limit}`;
      const ttl = this.cacheTtlMs ?? getMinuteCacheTtlMs(getTradingSession(), period);
      const loaded = await this.cache.getOrLoadWithFallback(key, ttl, () => this.provider.getMinuteBars(code, options));
      const data = loaded.fromFallback ? staleMinuteBars(loaded.value) : loaded.value;
      const latest = data.at(-1);
      return {
        success: true,
        data,
        meta: {
          source: latest?.source ?? this.provider.source,
          status: latest?.status ?? "unavailable",
          marketTimestamp: latest?.timestamp ?? null,
          receivedAt: latest?.receivedAt ?? new Date().toISOString(),
          isDemo: latest?.isDemo ?? this.provider.mode !== "live",
          mode: this.provider.mode,
          isReplay: latest?.isReplay ?? this.provider.mode === "replay",
          delayedSeconds: latest ? Math.max(0, Math.round((Date.now() - new Date(latest.timestamp).getTime()) / 1000)) : 0,
          period,
        },
      };
    } catch (error) {
      const keyPrefix = `minutes:${code}:${options.period}`;
      const fallback = this.cache.getLastSuccess<MinuteBar[]>(keyPrefix);
      if (fallback) {
        const data = staleMinuteBars(fallback);
        const latest = data.at(-1);
        return {
          success: true,
          data,
          meta: {
            source: latest?.source ?? this.provider.source,
            status: "stale",
            marketTimestamp: latest?.timestamp ?? null,
            receivedAt: latest?.receivedAt ?? new Date().toISOString(),
            isDemo: latest?.isDemo ?? true,
            mode: this.provider.mode,
            isReplay: latest?.isReplay ?? false,
            delayedSeconds: 0,
            period: options.period,
          },
        };
      }
      return this.failure(error);
    }
  }

  async getSectorSnapshots(): Promise<MarketDataResult<SectorSnapshot[]>> {
    try {
      const data = await this.cache.getOrLoad("sectors", this.cacheTtlMs ?? getCacheTtlMs(), () => this.provider.getSectorSnapshots());
      return { success: true, data, meta: metaFromData(data[0], this.provider.mode) };
    } catch (error) {
      return this.failure(error);
    }
  }

  async getMarketOverview(): Promise<MarketDataResult<MarketOverview>> {
    try {
      const data = await this.cache.getOrLoad("overview", this.cacheTtlMs ?? getCacheTtlMs(), () => this.provider.getMarketOverview());
      return { success: true, data, meta: metaFromData(data, this.provider.mode) };
    } catch (error) {
      return this.failure(error);
    }
  }

  async healthCheck() {
    return this.provider.healthCheck();
  }

  private failure(error: unknown): MarketDataResult<never> {
    if (error instanceof MarketDataError) {
      return { success: false, error: { code: error.code, message: error.message } };
    }
    return { success: false, error: { code: "MARKET_DATA_ERROR", message: "行情数据服务异常" } };
  }
}
