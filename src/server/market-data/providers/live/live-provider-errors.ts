import { MarketDataError } from "../../market-data-errors";

export class LiveProviderNotConfiguredError extends MarketDataError {
  constructor() {
    super("LIVE_PROVIDER_NOT_CONFIGURED", "真实行情供应商尚未配置", 503);
  }
}

export class LiveProviderAuthError extends MarketDataError {
  constructor() {
    super("LIVE_PROVIDER_AUTH_FAILED", "真实行情供应商认证失败", 401);
  }
}

export class LiveProviderRateLimitedError extends MarketDataError {
  constructor() {
    super("RATE_LIMITED", "行情供应商请求频率受限", 429);
  }
}
