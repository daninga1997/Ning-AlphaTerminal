import type { MarketDailyBar } from "../../../types/market-data";
import type { DataIntegrityIssue, DataIntegrityIssueCode } from "../../../types/data-integrity";

export interface DailyBarsValidationResult {
  isValid: boolean;
  issues: DataIntegrityIssue[];
  latestDate: string | null;
  totalCount: number;
}

const MIN_HISTORY_DAYS = 120;

/**
 * 日线数据字段完整性校验
 */
export function validateDailyBars(
  bars: MarketDailyBar[] | null | undefined,
  expectedLatestDate: string,
): DailyBarsValidationResult {
  const issues: DataIntegrityIssue[] = [];
  let latestDate: string | null = null;
  let totalCount = 0;

  if (!bars || bars.length === 0) {
    issues.push(critical("DAILY_BARS_MISSING", "日线数据缺失"));
    return { isValid: false, issues, latestDate: null, totalCount: 0 };
  }

  totalCount = bars.length;

  // 数量检查
  if (bars.length < MIN_HISTORY_DAYS) {
    issues.push(critical("INSUFFICIENT_HISTORY", `日线数据不足：${bars.length} 条（需要至少 ${MIN_HISTORY_DAYS} 条）`));
  }

  // 日期单调性和重复检查
  const dates: string[] = [];
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (!bar) continue;
    dates.push(bar.date);

    // OHLC 合法性
    if (!isFinite(bar.open) || !isFinite(bar.high) || !isFinite(bar.low) || !isFinite(bar.close)) {
      issues.push(critical("OHLC_INVALID", `日期 ${bar.date}: OHLC含NaN或Infinity`));
    }
    if (bar.high < bar.low) {
      issues.push(critical("OHLC_INVALID", `日期 ${bar.date}: 最高价(${bar.high}) < 最低价(${bar.low})`));
    }
    if (bar.high < bar.open || bar.high < bar.close) {
      issues.push(critical("OHLC_INVALID", `日期 ${bar.date}: 最高价低于开盘或收盘`));
    }
    if (bar.low > bar.open || bar.low > bar.close) {
      issues.push(critical("OHLC_INVALID", `日期 ${bar.date}: 最低价高于开盘或收盘`));
    }

    // 成交量
    if (bar.volume < 0 || !isFinite(bar.volume)) {
      issues.push(critical("VOLUME_INVALID", `日期 ${bar.date}: 成交量无效`));
    }

    // 成交额
    if (bar.amount < 0 || !isFinite(bar.amount)) {
      issues.push(critical("VOLUME_INVALID", `日期 ${bar.date}: 成交额无效`));
    }

    // 日期单调性
    if (i > 0) {
      const prev = dates[i - 1];
      if (prev && bar.date <= prev) {
        issues.push(critical("OHLC_INVALID", `日期不单调: ${prev} → ${bar.date}`));
      }
    }
  }

  // 重复日期检查
  const uniqueDates = new Set(dates);
  if (uniqueDates.size !== dates.length) {
    issues.push(critical("OHLC_INVALID", `日线包含重复日期（共 ${dates.length} 条，唯一 ${uniqueDates.size} 条）`));
  }

  // 最新日期检查
  latestDate = bars[bars.length - 1]?.date ?? null;
  if (latestDate && latestDate !== expectedLatestDate) {
    issues.push(warning("WRONG_TRADING_DATE", `日线最新日期(${latestDate})与预期(${expectedLatestDate})不一致`));
  }

  // 来源检查
  const sources = new Set(bars.map((b) => b.source));
  if (sources.size > 1) {
    issues.push(warning("SOURCE_CONFLICT", `日线数据来源不一致: ${Array.from(sources).join(", ")}`));
  }

  // 数据太旧
  if (latestDate && expectedLatestDate) {
    const diffDays = dateDiffInDays(latestDate, expectedLatestDate);
    if (diffDays > 3) {
      issues.push(warning("DATA_TOO_OLD", `日线最新日期(${latestDate})比预期晚${diffDays}天`));
    }
  }

  return {
    isValid: issues.filter((i) => i.isCritical).length === 0,
    issues,
    latestDate,
    totalCount,
  };
}

function dateDiffInDays(date1: string, date2: string): number {
  const d1 = new Date(date1 + "T00:00:00Z");
  const d2 = new Date(date2 + "T00:00:00Z");
  return Math.abs(Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

function critical(code: DataIntegrityIssueCode, message: string): DataIntegrityIssue {
  return { code, message, isCritical: true };
}

function warning(code: DataIntegrityIssueCode, message: string): DataIntegrityIssue {
  return { code, message, isCritical: false };
}