import { LiveProviderNotConfiguredError } from "./live-provider-errors";

export type LiveProviderConfig = {
  baseUrl: string;
  apiKeyConfigured: boolean;
  providerName: string;
  timeoutMs: number;
  minimumIntervalMs: number;
};

export function getLiveProviderConfig(): LiveProviderConfig {
  const baseUrl = process.env.MARKET_DATA_LIVE_BASE_URL ?? "";
  const apiKey = process.env.MARKET_DATA_LIVE_API_KEY ?? "";
  const providerName = process.env.MARKET_DATA_LIVE_PROVIDER ?? process.env.MARKET_DATA_LIVE_PROVIDER_NAME ?? "";
  const timeoutMs = Number(process.env.MARKET_DATA_LIVE_TIMEOUT_MS ?? 5000);
  const minimumIntervalMs = Number(process.env.MARKET_DATA_LIVE_MIN_INTERVAL_MS ?? 60_000);

  return {
    baseUrl,
    apiKeyConfigured: apiKey.length > 0,
    providerName,
    timeoutMs,
    minimumIntervalMs,
  };
}

export function assertLiveProviderConfigured(config = getLiveProviderConfig()): void {
  if (!config.baseUrl || !config.providerName || !config.apiKeyConfigured) {
    throw new LiveProviderNotConfiguredError();
  }
}
