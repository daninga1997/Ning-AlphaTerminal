export class TradingCalendarError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "TradingCalendarError";
  }
}

export const TRADING_CALENDAR_ERRORS = {
  FUTURE_DATE: new TradingCalendarError("日期不能是未来时间", "FUTURE_DATE"),
  INVALID_DATE: new TradingCalendarError("无效的日期格式", "INVALID_DATE"),
} as const;