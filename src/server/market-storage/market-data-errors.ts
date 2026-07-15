import { MarketDataError } from "../market-data/market-data-errors";

export class MarketStorageError extends MarketDataError {
  constructor(code: string, message: string, status = 500) {
    super(code, message, status);
  }
}

export function assertFiniteMarketNumber(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new MarketStorageError("INVALID_MARKET_NUMBER", `市场数据字段无效: ${field}`, 400);
  }
}

export function assertValidStockCode(code: string): void {
  if (!/^(000|001|002)\d{3}$/.test(code)) {
    throw new MarketStorageError("INVALID_STOCK_CODE", "股票代码不在深圳主板观察范围内", 400);
  }
}
