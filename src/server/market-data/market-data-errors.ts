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

const allowedStockCodePattern = /^(000|001|002|003)\d{3}$/;

export function isAllowedStockCode(code: string): boolean {
  return allowedStockCodePattern.test(code);
}

export function assertAllowedStockCode(code: string): void {
  if (!isAllowedStockCode(code)) {
    throw new MarketDataError("INVALID_STOCK_CODE", "股票代码不在深市主板范围内（000/001/002/003开头）", 400);
  }
}
