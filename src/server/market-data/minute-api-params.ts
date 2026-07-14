import type { MinuteBarPeriod } from "../../types/market-data";
import { assertAllowedStockCode, MarketDataError } from "./market-data-errors";

const allowedPeriods = new Set<MinuteBarPeriod>(["1m", "5m", "15m", "30m", "60m"]);

export function parseMinuteRequest(code: string, searchParams: URLSearchParams) {
  assertAllowedStockCode(code);
  const period = (searchParams.get("period") ?? "1m") as MinuteBarPeriod;
  if (!allowedPeriods.has(period)) throw new MarketDataError("INVALID_PERIOD", "period参数无效", 400);
  const limit = Number(searchParams.get("limit") ?? 120);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new MarketDataError("INVALID_LIMIT", "limit参数无效", 400);
  }
  const startTime = searchParams.get("start") ?? undefined;
  const endTime = searchParams.get("end") ?? undefined;
  if (startTime && Number.isNaN(new Date(startTime).getTime())) {
    throw new MarketDataError("INVALID_TIME_RANGE", "start参数无效", 400);
  }
  if (endTime && Number.isNaN(new Date(endTime).getTime())) {
    throw new MarketDataError("INVALID_TIME_RANGE", "end参数无效", 400);
  }
  return { period, limit, startTime, endTime };
}
