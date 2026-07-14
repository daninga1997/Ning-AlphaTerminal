import type {
  MarketDailyBar,
  MarketDataMode,
  MarketOverview,
  MinuteBar,
  MinuteBarPeriod,
  SectorSnapshot,
  StockQuote,
} from "../../types/market-data";

export type DailyBarOptions = {
  period?: "120d";
};

export type MinuteBarOptions = {
  period: MinuteBarPeriod;
  startTime?: string;
  endTime?: string;
  limit?: number;
};

export type ProviderCapabilities = {
  supportsQuotes: boolean;
  supportsDailyBars: boolean;
  supportsMinuteBars: boolean;
  supportsSectors: boolean;
  supportsMarketOverview: boolean;
  minimumRefreshIntervalMs: number;
  supportedMinutePeriods: readonly MinuteBarPeriod[];
  isLicensedSource: boolean;
};

export type ProviderHealth = {
  ok: boolean;
  source: string;
  mode: MarketDataMode;
  capabilities: ProviderCapabilities;
  message?: string;
};

export interface MarketDataProvider {
  readonly source: string;
  readonly mode: MarketDataMode;
  getQuote(code: string): Promise<StockQuote>;
  getQuotes(codes: string[]): Promise<StockQuote[]>;
  getDailyBars(code: string, options?: DailyBarOptions): Promise<MarketDailyBar[]>;
  getMinuteBars(code: string, options: MinuteBarOptions): Promise<MinuteBar[]>;
  getSectorSnapshots(): Promise<SectorSnapshot[]>;
  getMarketOverview(): Promise<MarketOverview>;
  healthCheck(): Promise<ProviderHealth>;
}

export const mockProviderCapabilities: ProviderCapabilities = {
  supportsQuotes: true,
  supportsDailyBars: true,
  supportsMinuteBars: true,
  supportsSectors: true,
  supportsMarketOverview: true,
  minimumRefreshIntervalMs: 60_000,
  supportedMinutePeriods: ["1m", "5m", "15m", "30m", "60m"],
  isLicensedSource: false,
};
