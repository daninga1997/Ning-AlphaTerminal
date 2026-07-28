import type { MarketDataMode } from "../../types/market-data";
import type { MarketDataProvider } from "./market-data-provider";
import { MarketDataError } from "./market-data-errors";
import { MockMarketDataProvider } from "./mock-market-data-provider";
import { TencentProvider } from "./providers/tencent/tencent-provider";
import { HithinkProvider } from "./providers/hithink/hithink-provider";
import { ReplayMarketDataProvider } from "./providers/replay/replay-market-data-provider";

export function getMarketDataMode(): MarketDataMode {
  const mode = process.env.MARKET_DATA_MODE ?? "mock";
  if (mode === "mock" || mode === "replay" || mode === "live") return mode;
  throw new MarketDataError("INVALID_MARKET_DATA_MODE", "MARKET_DATA_MODE配置无效", 500);
}

export function getProvider(mode: MarketDataMode = getMarketDataMode()): MarketDataProvider {
  if (mode === "mock") return new MockMarketDataProvider();
  if (mode === "replay") return new ReplayMarketDataProvider();
  if (mode === "live") {
    if (process.env.MARKET_DATA_LIVE_PROVIDER === "hithink") return new HithinkProvider();
    return new TencentProvider();
  }
  throw new MarketDataError("INVALID_MARKET_DATA_MODE", "MARKET_DATA_MODE配置无效", 500);
}
