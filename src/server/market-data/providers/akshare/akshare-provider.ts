import type {
  MarketDailyBar,
  MarketOverview,
  MinuteBar,
  SectorSnapshot,
  StockQuote,
} from "../../../../types/market-data";
import type { MarketDataProvider, MinuteBarOptions, ProviderHealth } from "../../market-data-provider";
import { akshareCapabilityUnavailable } from "./akshare-provider-errors";
import { AkShareApiClient } from "./akshare-api-client";
import { getAkShareProviderConfig, type AkShareProviderConfig } from "./akshare-provider-config";
import {
  normalizeAkShareDailyBarsResponse,
  normalizeAkShareMinuteBarsResponse,
  normalizeAkShareQuoteResponse,
} from "./akshare-response-normalizer";

type AkShareProviderOptions = AkShareProviderConfig & {
  fetcher?: typeof fetch;
};

export type AkShareProviderHealth = ProviderHealth & {
  akshareVersion?: string;
  lastSuccessAt?: string | null;
  cache?: unknown;
  disclaimer?: string;
};

const akshareCapabilities = {
  supportsQuotes: true,
  supportsDailyBars: true,
  supportsMinuteBars: true,
  supportsSectors: false,
  supportsMarketOverview: false,
  minimumRefreshIntervalMs: 60_000,
  supportedMinutePeriods: ["1m", "5m", "15m", "30m", "60m"] as const,
  isLicensedSource: false,
};

export class AkShareProvider implements MarketDataProvider {
  readonly source = "akshare";
  readonly mode = "live" as const;
  private readonly client: AkShareApiClient;

  constructor(options: AkShareProviderOptions = getAkShareProviderConfig()) {
    this.client = new AkShareApiClient(options);
  }

  async getQuote(code: string): Promise<StockQuote> {
    const quote = (await this.getQuotes([code]))[0];
    if (!quote) throw akshareCapabilityUnavailable("AKShare未返回该股票报价");
    return quote;
  }

  async getQuotes(codes: string[]): Promise<StockQuote[]> {
    const payload = await this.client.get<StockQuote[]>(`/quotes?codes=${codes.join(",")}`);
    return normalizeAkShareQuoteResponse(payload);
  }

  async getDailyBars(code: string): Promise<MarketDailyBar[]> {
    const payload = await this.client.get<MarketDailyBar[]>(`/stocks/${code}/daily-bars`);
    return normalizeAkShareDailyBarsResponse(payload);
  }

  async getMinuteBars(code: string, options: MinuteBarOptions): Promise<MinuteBar[]> {
    const params = new URLSearchParams({
      period: options.period,
      limit: String(options.limit ?? 120),
    });
    if (options.startTime) params.set("start", options.startTime);
    if (options.endTime) params.set("end", options.endTime);
    const payload = await this.client.get<MinuteBar[]>(`/stocks/${code}/minute-bars?${params.toString()}`);
    return normalizeAkShareMinuteBarsResponse(payload);
  }

  async getSectorSnapshots(): Promise<SectorSnapshot[]> {
    throw akshareCapabilityUnavailable("AKShare V1暂不提供统一板块快照");
  }

  async getMarketOverview(): Promise<MarketOverview> {
    throw akshareCapabilityUnavailable("AKShare V1暂不提供统一市场总览");
  }

  async healthCheck(): Promise<AkShareProviderHealth> {
    try {
      const payload = await this.client.get<{
        ok: boolean;
        akshareVersion?: string;
        lastSuccessAt?: string | null;
        cache?: unknown;
        disclaimer?: string;
      }>("/health");
      return {
        ok: payload.data.ok,
        source: "akshare",
        mode: "live",
        capabilities: akshareCapabilities,
        message: payload.data.ok ? "AKShare服务可用" : "AKShare服务不可用",
        akshareVersion: payload.data.akshareVersion,
        lastSuccessAt: payload.data.lastSuccessAt,
        cache: payload.data.cache,
        disclaimer: payload.data.disclaimer,
      };
    } catch {
      return {
        ok: false,
        source: "akshare",
        mode: "live",
        capabilities: akshareCapabilities,
        message: "AKShare Python服务不可用",
      };
    }
  }
}
