import { MarketDataError } from "../../market-data-errors";
import { LiveProviderAuthError, LiveProviderRateLimitedError } from "./live-provider-errors";

export class LiveRateLimiter {
  private lastCallAt = 0;

  constructor(private readonly minimumIntervalMs: number) {}

  async schedule<T>(operation: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const waitMs = Math.max(0, this.lastCallAt + this.minimumIntervalMs - now);
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 20)));
    this.lastCallAt = Date.now();
    return retryWithBackoff(operation);
  }
}

export async function retryWithBackoff<T>(operation: () => Promise<T>, maxRetries = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof LiveProviderAuthError) throw error;
      if (!(error instanceof LiveProviderRateLimitedError) || attempt >= maxRetries) throw error;
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 10 * 2 ** attempt));
    }
  }
}

export function normalizeLiveError(status: number): MarketDataError {
  if (status === 401 || status === 403) return new LiveProviderAuthError();
  if (status === 429) return new LiveProviderRateLimitedError();
  return new MarketDataError("LIVE_PROVIDER_ERROR", "真实行情供应商返回异常", 502);
}
