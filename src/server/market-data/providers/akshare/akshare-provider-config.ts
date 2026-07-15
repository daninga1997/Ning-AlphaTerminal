export type AkShareProviderConfig = {
  baseUrl: string;
  timeoutMs: number;
};

export function getAkShareProviderConfig(): AkShareProviderConfig {
  return {
    baseUrl: process.env.AKSHARE_SERVICE_BASE_URL ?? "http://127.0.0.1:8001",
    timeoutMs: Number(process.env.AKSHARE_SERVICE_TIMEOUT_MS ?? 30_000),
  };
}
