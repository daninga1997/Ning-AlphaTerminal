import type { TradingSession } from "../../types/market-data";
import { isConfiguredHoliday } from "./trading-calendar";

function getShanghaiParts(input: string | Date): { date: string; weekday: number; minutes: number } {
  const date = typeof input === "string" ? new Date(input) : input;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    weekday: weekdayMap[value("weekday")] ?? 0,
    minutes: hour * 60 + minute,
  };
}

export function getTradingSession(input: string | Date = new Date()): TradingSession {
  const { date, weekday, minutes } = getShanghaiParts(input);
  if (weekday === 0 || weekday === 6 || isConfiguredHoliday(date)) return "non_trading_day";
  if (minutes < 9 * 60 + 15) return "premarket";
  if (minutes >= 9 * 60 + 15 && minutes <= 9 * 60 + 25) return "auction";
  if (minutes >= 9 * 60 + 30 && minutes <= 11 * 60 + 30) return "morning";
  if (minutes > 11 * 60 + 30 && minutes < 13 * 60) return "lunch_break";
  if (minutes >= 13 * 60 && minutes <= 15 * 60) return "afternoon";
  return "closed";
}
