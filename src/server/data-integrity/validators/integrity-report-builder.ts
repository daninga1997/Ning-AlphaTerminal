import type { MarketDataMode, StockQuote, MarketDailyBar, MinuteBar, SectorSnapshot, MarketOverview } from "../../../types/market-data";
import type { DataIntegrityReport, DataIntegrityIssue, DataIntegrityStatus } from "../../../types/data-integrity";
import { getLatestExpectedTradingDate } from "../../trading-calendar/trading-day-resolver";
import { buildMarketTimeLock } from "../market-time-lock";
import { checkSourceConsistency } from "../source-consistency";
import { validateQuote } from "./quote-validator";
import { validateDailyBars } from "./daily-bars-validator";
import { validateMinuteBars } from "./minute-bars-validator";
import { validateSectors } from "./sector-validator";
import { validateMarketOverview } from "./market-overview-validator";
import { calculateCompleteness } from "../completeness-calculator";
import { resolveDataIntegrityStatus } from "../integrity-status-resolver";

export interface IntegrityReportInput {
  code: string;
  mode: MarketDataMode;
  quote: StockQuote | null;
  dailyBars: MarketDailyBar[] | null;
  minuteBars: MinuteBar[] | null;
  sectors: SectorSnapshot[] | null;
  marketOverview: MarketOverview | null;
}

/**
 * 构建完整的数据完整性报告
 */
export function buildIntegrityReport(input: IntegrityReportInput): DataIntegrityReport {
  const now = new Date();
  const latestTradingDate = getLatestExpectedTradingDate(now);
  const requestedAt = now.toISOString();

  const timeLock = buildMarketTimeLock({
    now,
    quoteTimestamp: input.quote?.marketTimestamp ?? null,
    dailyBarsLatestDate: input.dailyBars?.at(-1)?.date ?? null,
    minuteBarsLatestTimestamp: input.minuteBars?.at(-1)?.timestamp ?? null,
    providerReceivedAt: input.quote?.receivedAt ?? null,
    dataMode: input.mode,
  });

  const expectedDailyBarsDate = timeLock.expectedDailyBarsDate;

  // 校验各个数据源
  const quoteResult = validateQuote(input.quote, latestTradingDate);
  const dailyResult = validateDailyBars(input.dailyBars, expectedDailyBarsDate);
  const minuteResult = validateMinuteBars(input.minuteBars, latestTradingDate);
  const sectorResult = validateSectors(input.sectors, latestTradingDate);
  const overviewResult = validateMarketOverview(input.marketOverview, latestTradingDate);

  // 来源一致性
  const sourceResult = checkSourceConsistency({
    quote: input.quote ? { source: input.quote.source, mode: input.mode, isDemo: input.quote.isDemo } : null,
    daily: input.dailyBars?.[0] ? { source: input.dailyBars[0].source, mode: input.mode, isDemo: input.dailyBars[0].isDemo } : null,
    minute: input.minuteBars?.[0] ? { source: input.minuteBars[0].source, mode: input.mode, isDemo: input.minuteBars[0].isDemo } : null,
  });

  // 汇总所有issues
  const allIssues: DataIntegrityIssue[] = [
    ...quoteResult.issues,
    ...dailyResult.issues,
    ...minuteResult.issues,
    ...sectorResult.issues,
    ...overviewResult.issues,
    ...sourceResult.issues,
  ].filter((i) => i.isCritical);

  const allWarnings: DataIntegrityIssue[] = [
    ...quoteResult.issues,
    ...dailyResult.issues,
    ...minuteResult.issues,
    ...sectorResult.issues,
    ...overviewResult.issues,
    ...sourceResult.issues,
  ].filter((i) => !i.isCritical);

  // 计算完整度
  const completenessPercent = calculateCompleteness({
    hasValidQuote: quoteResult.isValid,
    hasValidDailyBars: dailyResult.isValid,
    hasValidMinuteBars: minuteResult.isValid,
    hasValidSector: sectorResult.isValid,
    hasValidMarketOverview: overviewResult.isValid,
    isSourceConsistent: sourceResult.isConsistent,
    criticalIssues: allIssues.map((i) => i.code),
  });

  // 确定完整性状态
  const status = resolveDataIntegrityStatus({
    completenessPercent,
    quoteValid: quoteResult.isValid,
    dailyValid: dailyResult.isValid,
    minuteValid: minuteResult.isValid,
    sourceConsistent: sourceResult.isConsistent,
    hasCriticalIssues: allIssues.length > 0,
    mode: input.mode,
  });

  // 权限和功能标志
  const canGenerateScore = status !== "unavailable" && status !== "demo_only";
  const canGenerateWatchZone = canGenerateScore && completenessPercent >= 40;
  const canGenerateEntryPrice = status === "complete" && completenessPercent >= 85;
  const canGenerateBuySignal = canGenerateEntryPrice && sourceResult.isConsistent;
  const canGenerateTradePlan = canGenerateBuySignal;

  const quoteDate = input.quote?.marketTimestamp?.slice(0, 10) ?? null;
  const minuteTime = input.minuteBars?.at(-1)?.timestamp ?? null;

  return {
    code: input.code,
    requestedAt,
    latestTradingDate,
    quoteTradingDate: quoteDate,
    dailyBarsLatestDate: dailyResult.latestDate,
    minuteBarsLatestDate: minuteTime,
    marketTimestamp: input.quote?.marketTimestamp ?? null,
    receivedAt: input.quote?.receivedAt ?? requestedAt,
    quoteSource: input.quote?.source ?? null,
    dailySource: input.dailyBars?.[0]?.source ?? null,
    minuteSource: input.minuteBars?.[0]?.source ?? null,
    marketDataMode: input.mode,
    status,
    permission: resolvePermission(status),
    completenessPercent,
    issues: allIssues,
    warnings: allWarnings,
    validatedAt: now.toISOString(),
    canGenerateScore,
    canGenerateWatchZone,
    canGenerateEntryPrice,
    canGenerateBuySignal,
    canGenerateTradePlan,
  };
}

function resolvePermission(status: DataIntegrityStatus): "full" | "watch_only" | "historical_only" | "blocked" {
  switch (status) {
    case "complete": return "full";
    case "partial": return "watch_only";
    case "stale": return "historical_only";
    default: return "blocked";
  }
}