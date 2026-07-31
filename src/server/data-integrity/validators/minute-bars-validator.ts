import type { MinuteBar } from "../../../types/market-data";
import type { DataIntegrityIssue, DataIntegrityIssueCode } from "../../../types/data-integrity";

export interface MinuteBarsValidationResult {
  isValid: boolean;
  issues: DataIntegrityIssue[];
  latestTimestamp: string | null;
  totalCount: number;
}

const LUNCH_START = "11:30";
const LUNCH_END = "13:00";
const MAX_STALE_SECONDS = 300; // 5分钟无新数据视为stale
const MAX_FUTURE_BUCKET_MS = 60_000;

/**
 * 分钟线数据字段完整性校验
 */
export function validateMinuteBars(
  bars: MinuteBar[] | null | undefined,
  expectedTradingDate: string,
): MinuteBarsValidationResult {
  const issues: DataIntegrityIssue[] = [];
  let latestTimestamp: string | null = null;
  let totalCount = 0;

  if (!bars || bars.length === 0) {
    issues.push(critical("MINUTE_BARS_MISSING", "分钟线数据缺失"));
    return { isValid: false, issues, latestTimestamp: null, totalCount: 0 };
  }

  totalCount = bars.length;

  // 检查每根分钟线
  let hasLunchBreakBar = false;
  let hasGap = false;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (!bar) continue;

    const time = extractTime(bar.timestamp);
    const date = extractDate(bar.timestamp);

    // 日期检查
    if (date !== expectedTradingDate) {
      issues.push(critical("WRONG_TRADING_DATE", `分钟线日期(${date})与预期交易日(${expectedTradingDate})不一致`));
    }

    // 午休伪造K线检查
    if (time > LUNCH_START && time < LUNCH_END) {
      hasLunchBreakBar = true;
    }

    // 未来时间检查
    if (new Date(bar.timestamp).getTime() > Date.now() + MAX_FUTURE_BUCKET_MS) {
      issues.push(critical("FUTURE_TIMESTAMP", `分钟线含未来时间: ${bar.timestamp}`));
    }

    // OHLC检查
    if (!isFinite(bar.open) || !isFinite(bar.high) || !isFinite(bar.low) || !isFinite(bar.close)) {
      issues.push(critical("OHLC_INVALID", `${bar.timestamp}: OHLC含非法值`));
    }
    if (bar.high < bar.low) {
      issues.push(critical("OHLC_INVALID", `${bar.timestamp}: 最高 < 最低`));
    }

    // 成交量
    if (bar.volume < 0 || !isFinite(bar.volume)) {
      issues.push(warning("VOLUME_INVALID", `${bar.timestamp}: 成交量无效`));
    }

    // 检查断档（相邻两根间隔超过5分钟，除午休外）
    if (i > 0) {
      const prev = bars[i - 1];
      if (prev) {
        const gapSeconds = (new Date(bar.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
        if (gapSeconds > 600 && !isLunchBreakSpan(prev.timestamp, bar.timestamp)) {
          hasGap = true;
        }
      }
    }
  }

  if (hasLunchBreakBar) {
    issues.push(critical("FUTURE_TIMESTAMP", "包含午休时段K线，数据异常"));
  }

  if (hasGap) {
    issues.push(warning("DATA_TOO_OLD", "分钟线存在严重断档"));
  }

  // 最新时间检查
  latestTimestamp = bars[bars.length - 1]?.timestamp ?? null;
  if (latestTimestamp) {
    const ageSeconds = (Date.now() - new Date(latestTimestamp).getTime()) / 1000;
    if (ageSeconds > MAX_STALE_SECONDS) {
      issues.push(warning("DATA_TOO_OLD", `最新分钟线已过期 ${Math.round(ageSeconds / 60)} 分钟`));
    }
  }

  // 来源一致性
  const sources = new Set(bars.map((b) => b.source));
  if (sources.size > 1) {
    issues.push(warning("SOURCE_CONFLICT", `分钟线来源不一致: ${Array.from(sources).join(", ")}`));
  }

  return {
    isValid: issues.filter((i) => i.isCritical).length === 0,
    issues,
    latestTimestamp,
    totalCount,
  };
}

function extractDate(iso: string): string {
  return iso.slice(0, 10);
}

function extractTime(iso: string): string {
  return iso.slice(11, 16);
}

function isLunchBreakSpan(prev: string, curr: string): boolean {
  const t1 = extractTime(prev);
  const t2 = extractTime(curr);
  return t1 <= LUNCH_START && t2 >= LUNCH_END;
}

function critical(code: DataIntegrityIssueCode, message: string): DataIntegrityIssue {
  return { code, message, isCritical: true };
}

function warning(code: DataIntegrityIssueCode, message: string): DataIntegrityIssue {
  return { code, message, isCritical: false };
}
