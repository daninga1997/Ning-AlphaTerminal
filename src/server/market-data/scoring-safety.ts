import type { MarketDataStatus } from "../../types/market-data";
import type { StockSignal } from "../../types/stock";

export function applyMarketDataSafetyGuard({
  signal,
  status,
  isDemo = false,
}: {
  signal: StockSignal;
  status: MarketDataStatus;
  isDemo?: boolean;
}): { signal: StockSignal; canGenerateTradePlan: boolean; warning: string | null; isDemo: boolean } {
  if (status === "unavailable") {
    return {
      signal: "avoid",
      canGenerateTradePlan: false,
      warning: "行情数据不可用，不能生成新的交易计划。",
      isDemo,
    };
  }
  if (status === "stale") {
    return {
      signal: signal === "buy" ? "wait" : signal,
      canGenerateTradePlan: false,
      warning: "行情数据已过期，不能生成新的可以买信号。",
      isDemo,
    };
  }
  return { signal, canGenerateTradePlan: true, warning: null, isDemo };
}
