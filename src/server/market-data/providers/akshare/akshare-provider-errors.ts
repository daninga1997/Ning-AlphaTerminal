import { MarketDataError } from "../../market-data-errors";

export function akshareServiceUnavailable(): MarketDataError {
  return new MarketDataError("AKSHARE_SERVICE_UNAVAILABLE", "AKShare Python服务不可用", 503);
}

export function akshareCapabilityUnavailable(message = "AKShare Provider暂不支持该能力"): MarketDataError {
  return new MarketDataError("CAPABILITY_UNAVAILABLE", message, 501);
}
