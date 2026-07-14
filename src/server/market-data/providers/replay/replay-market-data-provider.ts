import { mockStocks } from "../../../../data/mock-stocks";
import type {
  MarketDailyBar,
  MarketOverview,
  SectorSnapshot,
  StockQuote,
} from "../../../../types/market-data";
import { MockMarketDataProvider } from "../../mock-market-data-provider";
import { normalizeMinuteBars } from "../../minute-bars";
import type { DailyBarOptions, MarketDataProvider, MinuteBarOptions, ProviderHealth } from "../../market-data-provider";
import { mockProviderCapabilities } from "../../market-data-provider";
import { loadReplayMinuteBars } from "./csv-minute-bar-loader";
import { ReplayClock } from "./replay-clock";
import { replayConfig } from "./replay-config";

const replayCapabilities = {
  ...mockProviderCapabilities,
  minimumRefreshIntervalMs: 60_000,
  isLicensedSource: false,
};

export class ReplayMarketDataProvider implements MarketDataProvider {
  readonly source = replayConfig.source;
  readonly mode = "replay" as const;
  private readonly fallback = new MockMarketDataProvider();
  readonly clock = new ReplayClock(replayConfig.initialTime);

  async getQuote(code: string): Promise<StockQuote> {
    const bars = await this.getMinuteBars(code, { period: "1m", limit: 1 });
    const latest = bars.at(-1);
    if (!latest) return this.fallback.getQuote(code);
    const stock = mockStocks.find((item) => item.code === code);
    const previousClose = latest.previousClose;
    return {
      code,
      name: stock?.name ?? code,
      exchange: "SZSE",
      price: latest.close,
      previousClose,
      open: latest.open,
      high: latest.high,
      low: latest.low,
      change: Math.round((latest.close - previousClose) * 100) / 100,
      changePercent: Math.round(((latest.close - previousClose) / previousClose) * 10_000) / 100,
      volume: latest.volume,
      amount: latest.amount,
      turnoverRate: stock?.turnoverRate ?? 0,
      volumeRatio: stock?.volumeRatio ?? 1,
      bidPrice: Math.round((latest.close - 0.01) * 100) / 100,
      askPrice: Math.round((latest.close + 0.01) * 100) / 100,
      marketTimestamp: latest.timestamp,
      receivedAt: latest.receivedAt,
      status: "historical_replay",
      source: this.source,
      isDemo: true,
    };
  }

  async getQuotes(codes: string[]): Promise<StockQuote[]> {
    return Promise.all(codes.map((code) => this.getQuote(code).catch(() => this.fallback.getQuote(code))));
  }

  async getDailyBars(code: string, options?: DailyBarOptions): Promise<MarketDailyBar[]> {
    return this.fallback.getDailyBars(code, options);
  }

  async getMinuteBars(code: string, options: MinuteBarOptions) {
    const limit = Math.min(options.limit ?? 120, 500);
    const bars = loadReplayMinuteBars(code).filter((bar) => {
      if (options.startTime && bar.timestamp < options.startTime) return false;
      if (options.endTime && bar.timestamp > options.endTime) return false;
      return true;
    });
    return normalizeMinuteBars(bars, options.period).slice(-limit);
  }

  async getSectorSnapshots(): Promise<SectorSnapshot[]> {
    const sectors = await this.fallback.getSectorSnapshots();
    return sectors.map((sector) => ({ ...sector, source: this.source, status: "historical_replay", isDemo: true }));
  }

  async getMarketOverview(): Promise<MarketOverview> {
    const overview = await this.fallback.getMarketOverview();
    return { ...overview, source: this.source, status: "historical_replay", isDemo: true };
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      ok: true,
      source: this.source,
      mode: "replay",
      capabilities: replayCapabilities,
      message: "CSV分钟行情回放模式可用",
    };
  }
}
