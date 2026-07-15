import type { CompletenessInput } from "../../types/data-integrity";

interface ComputeInput extends CompletenessInput {}

const KEY_ERRORS_THAT_BLOCK = new Set([
  "WRONG_TRADING_DATE",
  "FUTURE_TIMESTAMP",
  "MOCK_LIVE_MIXED",
  "SOURCE_CONFLICT",
  "QUOTE_MISSING",
  "DAILY_BARS_MISSING",
  "PROVIDER_UNAVAILABLE",
  "PRICE_INVALID",
]);

/**
 * 计算数据完整度（0-100）
 *
 * 权重：
 * - Quote: 15
 * - Daily Bars: 25
 * - Minute Bars: 20
 * - Sector: 15
 * - Market Overview: 15
 * - Source一致性: 10
 */
export function calculateCompleteness(input: ComputeInput): number {
  // 关键错误直接返回0
  const hasBlockingError = input.criticalIssues.some((code) =>
    KEY_ERRORS_THAT_BLOCK.has(code),
  );
  if (hasBlockingError) return 0;

  let score = 0;

  if (input.hasValidQuote) score += 15;
  if (input.hasValidDailyBars) score += 25;
  if (input.hasValidMinuteBars) score += 20;
  if (input.hasValidSector) score += 15;
  if (input.hasValidMarketOverview) score += 15;
  if (input.isSourceConsistent) score += 10;

  return score;
}