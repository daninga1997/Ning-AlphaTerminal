/**
 * 同花顺金融数据 Provider
 *
 * REST API: https://fuyao.aicubes.cn
 * 股票代码格式: 002896.SZ (带交易所后缀)
 */
import type {
  MarketDailyBar,
  MarketOverview,
  MinuteBar,
  SectorSnapshot,
  StockQuote,
} from "@/types/market-data";
import type { MarketDataProvider, MinuteBarOptions, ProviderHealth } from "../../market-data-provider";

const BASE_URL = process.env.HITHINK_FINANCE_BASE_URL ?? "https://fuyao.aicubes.cn";
const API_KEY = process.env.HITHINK_FINANCE_API_KEY ?? "";

/** 将 002896 格式转换为 002896.SZ 格式 */
function toHithinkCode(code: string): string {
  if (code.includes(".")) return code;
  if (code.startsWith("000") || code.startsWith("001") || code.startsWith("002")) return `${code}.SZ`;
  if (code.startsWith("600") || code.startsWith("601") || code.startsWith("603") || code.startsWith("688")) return `${code}.SH`;
  return `${code}.SZ`;
}

/** 请求头 */
function authHeaders(): Record<string, string> {
  return {
    "X-api-key": API_KEY,
    "Accept": "application/json",
  };
}

export class HithinkProvider implements MarketDataProvider {
  readonly source = "hithink";
  readonly mode = "live" as const;

  async getQuote(code: string): Promise<StockQuote> {
    const quotes = await this.getQuotes([code]);
    if (!quotes[0]) throw new Error("同花顺未返回该股票报价");
    return quotes[0];
  }

  async getQuotes(codes: string[]): Promise<StockQuote[]> {
    const thscodes = codes.map(toHithinkCode).join(",");
    const url = `${BASE_URL}/api/a-share/prices/snapshot?thscodes=${thscodes}`;
    const resp = await fetch(url, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error("同花顺报价接口返回异常");

    const payload = await resp.json();
    const dataList = Array.isArray(payload?.data?.item) ? payload.data.item : [];

    return dataList.map((item: Record<string, unknown>) => {
      const code = String(item.ticker ?? "").replace(/\..*/, "");
      const price = Number(item.last_price ?? 0);
      return {
        code,
        name: String(item.name ?? ""),
        exchange: "SZSE" as const,
        price,
        previousClose: Number(item.prev_price ?? 0),
        open: Number(item.open_price ?? 0),
        high: Number(item.high_price ?? 0),
        low: Number(item.low_price ?? 0),
        change: Number(item.price_change ?? 0),
        changePercent: Number(item.price_change_ratio_pct ?? 0),
        volume: Number(item.volume ?? 0),
        amount: Number(item.turnover ?? 0),
        turnoverRate: 0,
        volumeRatio: null,
        bidPrice: price,
        askPrice: price,
        marketTimestamp: String(item.time ?? ""),
        receivedAt: new Date().toISOString(),
        status: "delayed" as const,
        source: "hithink",
        isDemo: false,
      };
    });
  }

  async getDailyBars(code: string): Promise<MarketDailyBar[]> {
    const thscode = toHithinkCode(code);
    const url = `${BASE_URL}/api/a-share/prices/daily?thscode=${thscode}&limit=120`;
    try {
      const resp = await fetch(url, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) return [];
      const payload = await resp.json();
      const dataList = Array.isArray(payload?.data) ? payload.data : [];
      return dataList.map((bar: Record<string, unknown>) => ({
        code,
        date: String(bar.date ?? ""),
        open: Number(bar.open ?? 0),
        high: Number(bar.high ?? 0),
        low: Number(bar.low ?? 0),
        close: Number(bar.close ?? 0),
        previousClose: Number(bar.preClose ?? bar.open ?? 0),
        volume: Number(bar.volume ?? 0),
        amount: Number(bar.amount ?? 0),
        turnoverRate: 0,
        source: "hithink" as const,
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
      source: "hithink",
      isDemo: false,
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      const resp = await fetch(`${BASE_URL}/api/a-share/prices/snapshot?thscodes=000001.SZ`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      return {
        ok: resp.ok,
        source: "hithink",
        mode: "live",
        capabilities: {
          supportsQuotes: true,
          supportsDailyBars: true,
          supportsMinuteBars: false,
          supportsSectors: false,
          supportsMarketOverview: false,
          minimumRefreshIntervalMs: 3000,
          supportedMinutePeriods: [],
          isLicensedSource: true,
        },
        message: resp.ok ? "healthy" : `HTTP ${resp.status}`,
      };
    } catch {
      return {
        ok: false,
        source: "hithink",
        mode: "live",
        capabilities: {
          supportsQuotes: true,
          supportsDailyBars: true,
          supportsMinuteBars: false,
          supportsSectors: false,
          supportsMarketOverview: false,
          minimumRefreshIntervalMs: 3000,
          supportedMinutePeriods: [],
          isLicensedSource: true,
        },
        message: "同花顺API不可用",
      };
    }
  }
}