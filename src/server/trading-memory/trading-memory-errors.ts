export class TradingMemoryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "TradingMemoryError";
  }
}

export function assertFound<T>(value: T | null, message = "交易计划不存在"): T {
  if (value === null) {
    throw new TradingMemoryError("PLAN_NOT_FOUND", message, 404);
  }
  return value;
}
