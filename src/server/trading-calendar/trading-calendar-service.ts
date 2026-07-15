import { getLatestExpectedTradingDate, isTradingDay, getTradingPhase, isWithinTradingHours } from "./trading-day-resolver";

/**
 * 交易日历服务 —— 统一入口
 *
 * 不依赖用户本地日期，所有判断基于 Asia/Shanghai 时区。
 */
export class TradingCalendarService {
  constructor(private readonly now: Date = new Date()) {}

  getLatestExpectedTradingDate(): string {
    return getLatestExpectedTradingDate(this.now);
  }

  isTradingDay(dateStr: string): boolean {
    return isTradingDay(dateStr);
  }

  getTradingPhase(): ReturnType<typeof getTradingPhase> {
    return getTradingPhase(this.now);
  }

  isWithinTradingHours(): boolean {
    return isWithinTradingHours(this.now);
  }

  isPostMarket(): boolean {
    return getTradingPhase(this.now) === "closed";
  }
}