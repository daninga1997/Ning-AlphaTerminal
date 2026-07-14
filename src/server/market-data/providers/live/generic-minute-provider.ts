import type {
  MarketDailyBar,
  MarketOverview,
  MinuteBar,
  SectorSnapshot,
  StockQuote,
} from "../../../../types/market-data";
import type { MarketDataProvider, ProviderHealth } from "../../market-data-provider";
import { LiveProviderNotConfiguredError } from "./live-provider-errors";
import { assertLiveProviderConfigured, getLiveProviderConfig } from "./live-provider-config";

const liveCapabilities = {
  supportsQuotes: false,
  supportsDailyBars: false,
  supportsMinuteBars: true,
  supportsSectors: false,
  supportsMarketOverview: false,
  minimumRefreshIntervalMs: 60_000,
  supportedMinutePeriods: ["1m", "5m", "15m", "30m", "60m"] as const,
  isLicensedSource: true,
};

export class GenericMinuteProvider implements MarketDataProvider {
  readonly mode = "live" as const;
  readonly source: string;

  constructor() {
    const config = getLiveProviderConfig();
    this.source = config.providerName || "live-provider-unconfigured";
    assertLiveProviderConfigured(config);
  }

  async getQuote(): Promise<StockQuote> {
    throw new LiveProviderNotConfiguredError();
  }

  async getQuotes(): Promise<StockQuote[]> {
    throw new LiveProviderNotConfiguredError();
  }

  async getDailyBars(): Promise<MarketDailyBar[]> {
    throw new LiveProviderNotConfiguredError();
  }

  async getMinuteBars(): Promise<MinuteBar[]> {
    throw new LiveProviderNotConfiguredError();
  }

  async getSectorSnapshots(): Promise<SectorSnapshot[]> {
    throw new LiveProviderNotConfiguredError();
  }

  async getMarketOverview(): Promise<MarketOverview> {
    throw new LiveProviderNotConfiguredError();
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      ok: false,
      source: this.source,
      mode: "live",
      capabilities: liveCapabilities,
      message: "真实行情供应商尚未配置",
    };
  }
}
