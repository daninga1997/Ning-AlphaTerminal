import type {
  MarketDailyBar,
  MarketOverview,
  MinuteBar,
  SectorSnapshot,
  StockQuote,
} from "@/types/market-data";
import type { MarketDataProvider, MinuteBarOptions, ProviderHealth } from "../../market-data-provider";

const TENDURE_BASE_URL = process.env.TENDURE_SERVICE_BASE_URL ?? "http://127.0.0.1:8001";

export class TencentProvider implements MarketDataProvider {
  readonly source = "tencent";
  readonly mode = "live" as const;

  async getQuote(code: string): Promise<StockQuote> {
    const quotes = await this.getQuotes([code]);
    if (!quotes[0]) throw new Error("腾讯行情未返回该股票报价");
    return quotes[0];
  }

  async getQuotes(codes: string[]): Promise<StockQuote[]> {
    const url = `${TENDURE_BASE_URL}/quotes?codes=${codes.join(",")}`;
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

  async getDailyBars(_code: string): Promise<MarketDailyBar[]> {
    // 日线通过 AKShare stock_zh_a_hist 获取，此Provider仅处理报价
    return [];
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
      const resp = await fetch(`${TENDURE_BASE_URL}/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      const payload = await resp.json();
      return {
        ok: payload.status === "healthy" || payload.status === "starting",
        source: "tencent",
        mode: "live",
        capabilities: {
          supportsQuotes: true,
          supportsDailyBars: false,
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
          supportsDailyBars: false,
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