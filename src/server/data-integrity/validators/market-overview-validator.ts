import type { MarketOverview } from "../../../types/market-data";
import type { DataIntegrityIssue, DataIntegrityIssueCode } from "../../../types/data-integrity";

export interface MarketOverviewValidationResult {
  isValid: boolean;
  issues: DataIntegrityIssue[];
  tradingSession: string | null;
}

export function validateMarketOverview(
  overview: MarketOverview | null | undefined,
  expectedTradingDate: string,
): MarketOverviewValidationResult {
  const issues: DataIntegrityIssue[] = [];

  if (!overview) {
    issues.push(warn("MARKET_OVERVIEW_MISSING", "市场总览数据缺失"));
    return { isValid: true, issues, tradingSession: null };
  }

  if (overview.marketTimestamp) {
    const overviewDate = extractDate(overview.marketTimestamp);
    if (overviewDate !== expectedTradingDate) {
      issues.push(warn("WRONG_TRADING_DATE", `市场总览日期(${overviewDate})与预期(${expectedTradingDate})不一致`));
    }
  }

  if (overview.advancingCount < 0 || !isFinite(overview.advancingCount)) {
    issues.push(warn("VOLUME_INVALID", "上涨家数无效"));
  }
  if (overview.decliningCount < 0 || !isFinite(overview.decliningCount)) {
    issues.push(warn("VOLUME_INVALID", "下跌家数无效"));
  }
  if (overview.totalAmount < 0 || !isFinite(overview.totalAmount)) {
    issues.push(warn("VOLUME_INVALID", "成交额无效"));
  }
  if (!overview.source) {
    issues.push(warn("PROVIDER_UNAVAILABLE", "市场总览来源缺失"));
  }

  return {
    isValid: issues.filter((i) => i.isCritical).length === 0,
    issues,
    tradingSession: overview.tradingSession,
  };
}

function warn(code: DataIntegrityIssueCode, message: string): DataIntegrityIssue {
  return { code, message, isCritical: false };
}

function extractDate(iso: string): string {
  return iso.slice(0, 10);
}