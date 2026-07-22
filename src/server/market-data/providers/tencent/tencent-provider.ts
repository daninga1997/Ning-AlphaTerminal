import type {
  MarketDailyBar,
  MarketOverview,
  MinuteBar,
  SectorSnapshot,
  StockQuote,
} from "@/types/market-data";
import type { MarketDataProvider, MinuteBarOptions, ProviderHealth } from "../../market-data-provider";

const TENCENT_BASE_URL = process.env.TENCENT_SERVICE_BASE_URL ?? "http://127.0.0.1:8001";

export class TencentProvider implements MarketDataProvider {
  readonly source = "tencent";
  readonly mode = "live" as const;

  async getQuote(code: string): Promise<StockQuote> {
    const quotes = await this.getQuotes([code]);
    if (!quotes[0]) throw new Error("腾讯行情未返回该股票报价");
    return quotes[0];
  }

  async getQuotes(codes: string[]): Promise<StockQuote[]> {
    const url = `${TENCENT_BASE_URL}/quotes?codes=${codes.join(",")}`;
    const resp = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const payload = await resp.json();

    if (!payload.success || !payload.data) {
      throw new Error("腾讯行情接口返回异常");
    }

    return payload.data.map((item: Record<string, unknown>) => ({
      code: String(item.code ?? ""),
      name: String(item.name ?? ""),
      exchange: "SZSE" as const,
      price: Number(item.price ?? 0),
      previousClose: Number(item.previousClose ?? 0),
      open: Number(item.open ?? 0),
      high: Number(item.high ?? 0),
      low: Number(item.low ?? 0),
      change: Number(item.change ?? 0),
      changePercent: Number(item.changePercent ?? 0),
      volume: Number(item.volume ?? 0),
      amount: Number(item.amount ?? 0),
      turnoverRate: Number(item.turnoverRate ?? 0),
      volumeRatio: Number(item.volumeRatio ?? 0),
      bidPrice: Number(item.price ?? 0),
      askPrice: Number(item.price ?? 0),
      marketTimestamp: String(item.marketTimestamp ?? ""),
      receivedAt: String(item.receivedAt ?? ""),
      status: (item.status as StockQuote["status"]) ?? "delayed",
      source: String(item.source ?? "tencent"),
      isDemo: Boolean(item.isDemo ?? false),
    }));
  }

  async getDailyBars(code: string): Promise<MarketDailyBar[]> {
    try {
      const url = `${TENCENT_BASE_URL}/history?symbol=${code}&period=day&count=120`;
      const resp = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) return [];
      const payload = await resp.json();
      if (!Array.isArray(payload?.data) || payload.data.length === 0) return [];

      return payload.data
        .filter((bar: Record<string, unknown>) =>
          [bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite),
        )
        .map((bar: Record<string, unknown>) => ({
          code,
          date: String(bar.time ?? ""),
          open: Number(bar.open),
          high: Number(bar.high),
          low: Number(bar.low),
          close: Number(bar.close),
          previousClose: Number(bar.open),
          volume: Number(bar.volume),
          amount: Number(bar.close) * Number(bar.volume),
          turnoverRate: 0,
          source: "tencent" as const,
          status: "delayed" as const,
          isDemo: false,
        }));
    } catch {
      return [];
    }
  }

  async getMinuteBars(_code: string, _options: MinuteBarOptions): Promise<MinuteBar[]> {
    return [];
  }

  async getSectorSnapshots(): Promise<SectorSnapshot[]> {
    return [];
  }

  async getMarketOverview(): Promise<MarketOverview> {
    return {
      tradingSession: "morning",
      marketTimestamp: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      status: "unavailable",
      totalAmount: 0,
      advancingCount: 0,
      decliningCount: 0,
      unchangedCount: 0,
      limitUpCount: 0,
      limitDownCount: 0,
      marketScore: 0,
      source: "tencent",
      isDemo: false,
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const resp = await fetch(`${TENCENT_BASE_URL}/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      const payload = await resp.json();
      return {
        ok: payload.status === "healthy" || payload.status === "starting",
        source: "tencent",
        mode: "live",
        quoteLastSuccessAt: typeof payload.last_success_at === "string" ? payload.last_success_at : null,
        quoteLastFailureAt: typeof payload.last_failure_at === "string" ? payload.last_failure_at : null,
        dailyBarsLastSuccessAt:
          typeof payload.daily_bars_last_success_at === "string" ? payload.daily_bars_last_success_at : null,
        dailyBarsLastFailureAt:
          typeof payload.daily_bars_last_failure_at === "string" ? payload.daily_bars_last_failure_at : null,
        capabilities: {
          supportsQuotes: true,
          supportsDailyBars: true,
          supportsMinuteBars: false,
          supportsSectors: false,
          supportsMarketOverview: false,
          minimumRefreshIntervalMs: 3000,
          supportedMinutePeriods: [],
          isLicensedSource: false,
        },
        message: payload.status ?? "unknown",
      };
    } catch {
      return {
        ok: false,
        source: "tencent",
        mode: "live",
        capabilities: {
          supportsQuotes: true,
          supportsDailyBars: true,
          supportsMinuteBars: false,
          supportsSectors: false,
          supportsMarketOverview: false,
          minimumRefreshIntervalMs: 3000,
          supportedMinutePeriods: [],
          isLicensedSource: false,
        },
        message: "腾讯行情服务不可用",
      };
    }
  }
}
