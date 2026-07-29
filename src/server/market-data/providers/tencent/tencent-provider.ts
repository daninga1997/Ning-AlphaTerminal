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
    const searchParams = new URLSearchParams({
      symbol: _code,
      period: _options.period,
      limit: String(_options.limit ?? 120),
    });
    const response = await fetch(`${TENCENT_BASE_URL}/api/kline/minute?${searchParams}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("腾讯分钟K线接口请求失败");

    const payload = (await response.json()) as Record<string, unknown>;
    if (payload.success !== true || !Array.isArray(payload.data)) {
      throw new Error("腾讯分钟K线接口返回异常");
    }

    const source = typeof payload.source === "string" ? payload.source : "tencent";
    const status = minuteStatus(payload.status);
    const receivedAt = typeof payload.received_at === "string" ? payload.received_at : new Date().toISOString();
    let previousClose: number | null = null;

    return payload.data.map((item) => {
      if (!isMinutePayloadBar(item)) throw new Error("腾讯分钟K线数据无效");
      const open = Number(item.open);
      const close = Number(item.close);
      const high = Number(item.high);
      const low = Number(item.low);
      const volume = Number(item.volume);
      if (![open, close, high, low, volume].every(Number.isFinite) || high < Math.max(open, close, low) || low > Math.min(open, close, high) || volume < 0) {
        throw new Error("腾讯分钟K线数据无效");
      }
      const bar: MinuteBar = {
        code: _code,
        timestamp: item.time,
        open,
        high,
        low,
        close,
        volume,
        amount: close * volume,
        averagePrice: close,
        previousClose: previousClose ?? open,
        source,
        receivedAt,
        status,
        isDemo: false,
      };
      previousClose = close;
      return bar;
    });
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
        minuteBarsLastSuccessAt:
          typeof payload.minute_bars_last_success_at === "string" ? payload.minute_bars_last_success_at : null,
        minuteBarsLastFailureAt:
          typeof payload.minute_bars_last_failure_at === "string" ? payload.minute_bars_last_failure_at : null,
        capabilities: {
          supportsQuotes: true,
          supportsDailyBars: true,
          supportsMinuteBars: true,
          supportsSectors: false,
          supportsMarketOverview: false,
          minimumRefreshIntervalMs: 3000,
          supportedMinutePeriods: ["1m", "5m", "15m", "30m", "60m"],
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
          supportsMinuteBars: true,
          supportsSectors: false,
          supportsMarketOverview: false,
          minimumRefreshIntervalMs: 3000,
          supportedMinutePeriods: ["1m", "5m", "15m", "30m", "60m"],
          isLicensedSource: false,
        },
        message: "腾讯行情服务不可用",
      };
    }
  }
}

function isMinutePayloadBar(value: unknown): value is Record<string, unknown> & { time: string } {
  return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>).time === "string";
}

function minuteStatus(value: unknown): MinuteBar["status"] {
  if (value === "closed") return "market_closed";
  const allowed: MinuteBar["status"][] = ["fresh", "delayed", "stale", "unavailable"];
  return typeof value === "string" && allowed.includes(value as MinuteBar["status"])
    ? (value as MinuteBar["status"])
    : "unavailable";
}
