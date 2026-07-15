import { isHoliday } from "./holiday-calendar";
import { TRADING_CALENDAR_ERRORS } from "./trading-calendar-errors";

const SHANGHAI_TZ = "Asia/Shanghai";

/**
 * 将日期字符串或Date转换为 YYYY-MM-DD 上海时区
 */
function toShanghaiDateStr(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (isNaN(date.getTime())) {
    throw TRADING_CALENDAR_ERRORS.INVALID_DATE;
  }
  // 使用UTC方法避免时区偏移，先转为上海时区
  const offsetMs = 8 * 60 * 60 * 1000;
  const shanghaiTime = new Date(date.getTime() + offsetMs);
  const y = shanghaiTime.getUTCFullYear();
  const m = String(shanghaiTime.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shanghaiTime.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 将 Date 对象转为上海时区的 Hour:Minute
 */
function getShanghaiHourMinute(now: Date): { hour: number; minute: number } {
  const offsetMs = 8 * 60 * 60 * 1000;
  const shanghaiTime = new Date(now.getTime() + offsetMs);
  return {
    hour: shanghaiTime.getUTCHours(),
    minute: shanghaiTime.getUTCMinutes(),
  };
}

/**
 * 判断是否是周末
 */
function isWeekend(dateStr: string): boolean {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return false;
  const date = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!));
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * 判断指定日期是否为A股交易日
 * 规则：不是周末 && 不是节假日
 */
export function isTradingDay(dateStr: string): boolean {
  if (isWeekend(dateStr)) return false;
  if (isHoliday(dateStr)) return false;
  return true;
}

/**
 * 获取指定日期的上一个交易日
 */
export function getPreviousTradingDay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00+08:00");
  if (isNaN(date.getTime())) throw TRADING_CALENDAR_ERRORS.INVALID_DATE;

  let previous = new Date(date);
  previous.setUTCDate(previous.getUTCDate() - 1);

  // 最多回溯30天
  for (let i = 0; i < 30; i++) {
    const prevStr = toShanghaiDateStr(previous);
    if (isTradingDay(prevStr)) return prevStr;
    previous.setUTCDate(previous.getUTCDate() - 1);
  }

  throw new Error("无法找到上一个交易日");
}

/**
 * 获取指定日期的下一个交易日
 */
export function getNextTradingDay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00+08:00");
  if (isNaN(date.getTime())) throw TRADING_CALENDAR_ERRORS.INVALID_DATE;

  let next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);

  for (let i = 0; i < 30; i++) {
    const nextStr = toShanghaiDateStr(next);
    if (isTradingDay(nextStr)) return nextStr;
    next.setUTCDate(next.getUTCDate() + 1);
  }

  throw new Error("无法找到下一个交易日");
}

/**
 * 获取最新预期的交易日
 *
 * 规则：
 * - 交易日 15:10 以后：最新完整日线日期 = 当日
 * - 交易日 15:10 以前：最新完整日线日期 = 上一交易日
 * - 非交易日：返回最近一个交易日
 *
 * @param now 当前时间 (通常传 new Date())
 */
export function getLatestExpectedTradingDate(now: Date): string {
  const todayStr = toShanghaiDateStr(now);
  const { hour, minute } = getShanghaiHourMinute(now);
  const isPostMarket = hour > 15 || (hour === 15 && minute >= 10);

  if (isTradingDay(todayStr)) {
    if (isPostMarket) return todayStr;
    return getPreviousTradingDay(todayStr);
  }

  // 非交易日：往前找最近一个交易日
  return getPreviousTradingDay(todayStr);
}

/**
 * 交易阶段判断
 */
export type TradingPhase =
  | "premarket"
  | "auction"
  | "morning"
  | "lunch_break"
  | "afternoon"
  | "closed"
  | "non_trading_day";

/**
 * 获取当前交易阶段
 */
export function getTradingPhase(now: Date): TradingPhase {
  const todayStr = toShanghaiDateStr(now);

  if (!isTradingDay(todayStr)) return "non_trading_day";

  const { hour, minute } = getShanghaiHourMinute(now);
  const timeMinutes = hour * 60 + minute;

  if (timeMinutes < 9 * 60 + 15) return "premarket";
  if (timeMinutes < 9 * 60 + 25) return "auction";
  if (timeMinutes < 11 * 60 + 30) return "morning";
  if (timeMinutes < 13 * 60) return "lunch_break";
  if (timeMinutes < 15 * 60) return "afternoon";
  return "closed";
}

/**
 * 判断是否在交易时段内（早盘或午盘，不含集合竞价）
 */
export function isWithinTradingHours(now: Date): boolean {
  const phase = getTradingPhase(now);
  return phase === "morning" || phase === "afternoon";
}

/**
 * 判断是否是收盘后（15:00以后）
 */
export function isPostMarket(now: Date): boolean {
  const phase = getTradingPhase(now);
  return phase === "closed";
}

export { toShanghaiDateStr, getShanghaiHourMinute };