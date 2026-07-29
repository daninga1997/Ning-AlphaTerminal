import type { BacktestHistoryRequest, BacktestHistoryResponse } from "../../types/backtest";
import type { MarketDailyBar } from "../../types/market-data";

const MAX_TRADING_DAYS = 500;
const SHENZHEN_MAINBOARD_CODE = /^(000|001|002)\d{3}$/;
const TENCENT_SERVICE_BASE_URL = process.env.TENCENT_SERVICE_BASE_URL ?? "http://127.0.0.1:8001";

export class BacktestHistoryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "BacktestHistoryError";
  }
}

export function parseBacktestHistoryRequest(url: URL): BacktestHistoryRequest {
  const request = {
    code: url.searchParams.get("code")?.trim() ?? "",
    start: url.searchParams.get("start") ?? "",
    end: url.searchParams.get("end") ?? "",
  };
  validateRequest(request);
  return request;
}

export async function fetchBacktestHistory(request: BacktestHistoryRequest): Promise<BacktestHistoryResponse> {
  validateRequest(request);
  const searchParams = new URLSearchParams({ symbol: request.code, period: "day", count: String(MAX_TRADING_DAYS) });

  try {
    const response = await fetch(`${TENCENT_SERVICE_BASE_URL}/history?${searchParams}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw unavailableError();

    const payload = await response.json() as unknown;
    const normalized = normalizePayload(payload, request.code);
    const bars = normalized.bars.filter((bar) => bar.date >= request.start && bar.date <= request.end);
    if (bars.length > MAX_TRADING_DAYS) {
      throw new BacktestHistoryError("BACKTEST_RANGE_TOO_LARGE", "回测范围最多支持500个交易日", 400);
    }
    if (bars.length === 0) {
      throw new BacktestHistoryError("BACKTEST_HISTORY_EMPTY", "所选范围没有可用历史日线", 422);
    }

    return {
      bars,
      source: normalized.source,
      updatedAt: normalized.updatedAt,
      returnedTradingDays: bars.length,
    };
  } catch (error) {
    if (error instanceof BacktestHistoryError) throw error;
    throw unavailableError();
  }
}

function validateRequest(request: BacktestHistoryRequest): void {
  if (!SHENZHEN_MAINBOARD_CODE.test(request.code)) {
    throw new BacktestHistoryError("BACKTEST_INVALID_CODE", "仅支持深市主板股票代码", 400);
  }
  if (!isIsoDate(request.start) || !isIsoDate(request.end)) {
    throw new BacktestHistoryError("BACKTEST_INVALID_DATE", "日期必须使用YYYY-MM-DD格式", 400);
  }
  if (request.start > request.end) {
    throw new BacktestHistoryError("BACKTEST_INVALID_RANGE", "开始日期不能晚于结束日期", 400);
  }
}

function normalizePayload(payload: unknown, code: string): { bars: MarketDailyBar[]; source: string; updatedAt: string } {
  if (!isRecord(payload) || payload.success !== true || !Array.isArray(payload.data)) throw unavailableError();
  const rawBars = payload.data;
  const bars = rawBars.map((value, index) => normalizeBar(value, code, index, rawBars));
  validateOrderedUniqueBars(bars);

  return {
    bars,
    source: typeof payload.source === "string" ? payload.source : "tencent",
    updatedAt: typeof payload.updated_at === "string" ? payload.updated_at : new Date().toISOString(),
  };
}

function normalizeBar(value: unknown, code: string, index: number, rawBars: unknown[]): MarketDailyBar {
  if (!isRecord(value)) throw unavailableError();
  const date = typeof value.time === "string" ? value.time : "";
  const open = Number(value.open);
  const high = Number(value.high);
  const low = Number(value.low);
  const close = Number(value.close);
  const volume = Number(value.volume);
  if (
    !isIsoDate(date) ||
    ![open, high, low, close, volume].every(Number.isFinite) ||
    Math.min(open, high, low, close) <= 0 ||
    high < Math.max(open, low, close) ||
    low > Math.min(open, high, close) ||
    volume < 0
  ) {
    throw unavailableError();
  }

  const previous = index > 0 ? rawBars[index - 1] : null;
  const previousClose = isRecord(previous) && Number.isFinite(Number(previous.close)) ? Number(previous.close) : close;
  return {
    code,
    date,
    open,
    high,
    low,
    close,
    previousClose,
    volume,
    amount: close * volume,
    turnoverRate: 0,
    source: "tencent",
    isDemo: false,
  };
}

function validateOrderedUniqueBars(bars: MarketDailyBar[]): void {
  for (let index = 1; index < bars.length; index += 1) {
    if (bars[index - 1]!.date >= bars[index]!.date) throw unavailableError();
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unavailableError(): BacktestHistoryError {
  return new BacktestHistoryError("BACKTEST_HISTORY_UNAVAILABLE", "历史日线暂时不可用", 502);
}
