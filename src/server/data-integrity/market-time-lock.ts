import type { MarketDataMode } from "../../types/market-data";
import type { MarketTimeLock } from "../../types/data-integrity";
import { getLatestExpectedTradingDate, getTradingPhase, isWithinTradingHours, isPostMarket } from "../trading-calendar/trading-day-resolver";

/**
 * 行情时间锁
 *
 * 判断当前系统时间、交易阶段、数据日期的一致性，
 * 确定哪些数据可用于生成交易计划。
 */
export function buildMarketTimeLock(input: {
  now?: Date;
  quoteTimestamp: string | null;
  dailyBarsLatestDate: string | null;
  minuteBarsLatestTimestamp: string | null;
  providerReceivedAt: string | null;
  dataMode: MarketDataMode;
}): MarketTimeLock {
  const now = input.now ?? new Date();
  const latestExpectedTradingDate = getLatestExpectedTradingDate(now);
  const phase = getTradingPhase(now);

  const quoteDate = input.quoteTimestamp ? extractDate(input.quoteTimestamp) : null;
  const minuteDate = input.minuteBarsLatestTimestamp
    ? extractDate(input.minuteBarsLatestTimestamp)
    : null;

  // 收盘后才可以使用当日完整日线
  const canUseTodayDailyBars = isPostMarket(now);
  const expectedDailyBarsDate = canUseTodayDailyBars
    ? latestExpectedTradingDate
    : getLatestExpectedTradingDate(now);

  return {
    systemTime: now.toISOString(),
    tradingSession: phase,
    latestExpectedTradingDate,
    quoteDate,
    dailyBarsLatestDate: input.dailyBarsLatestDate,
    minuteBarsLatestTime: input.minuteBarsLatestTimestamp,
    providerReceivedAt: input.providerReceivedAt,
    dataMode: input.dataMode,
    isWithinTradingHours: isWithinTradingHours(now),
    isPostMarket: isPostMarket(now),
    canUseTodayDailyBars,
    expectedDailyBarsDate,
  };
}

/**
 * 从ISO时间戳提取 YYYY-MM-DD 日期
 */
function extractDate(iso: string): string {
  return iso.slice(0, 10);
}