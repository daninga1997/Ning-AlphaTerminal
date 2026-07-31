export class MarketDataError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 500,
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}

const allowedStockCodePattern = /^\d{6}$/;

export function isAllowedStockCode(code: string): boolean {
  return allowedStockCodePattern.test(code);
}

export function assertAllowedStockCode(code: string): void {
  if (!isAllowedStockCode(code)) {
    throw new MarketDataError("INVALID_STOCK_CODE", "股票代码无效（需要6位数字）", 400);
  }
}
