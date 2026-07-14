import { getDecisionSummary } from "@/components/stocks/detail/decision-summary";
import type { MarketDataMeta } from "@/types/market-data";
import type { StockAnalysis } from "@/types/stock";
import type { CreateTradingPlanInput, PlanType, TradingPlanStatus } from "./trading-plan-repository";

export function buildPlanInputFromStock(
  stock: StockAnalysis,
  options: {
    planType?: PlanType;
    status?: TradingPlanStatus;
    idempotencyKey?: string;
  } = {},
): CreateTradingPlanInput {
  const meta = (stock as StockAnalysis & { marketDataMeta?: MarketDataMeta }).marketDataMeta;
  const dataStatus = meta?.status ?? "fresh";
  const invalidReason = stock.tradeLevels.invalidReason;
  const planType = options.planType ?? "short_term";
  const planDate = stock.dataUpdatedAt.slice(0, 10);
  const forcedDraft = dataStatus === "stale" || dataStatus === "unavailable" || Boolean(invalidReason);
  const status = options.status ?? (forcedDraft ? "draft" : stock.signal === "buy" ? "active" : "draft");
  const decision = getDecisionSummary(stock);

  return {
    idempotencyKey: options.idempotencyKey ?? `${stock.code}-${planType}-${planDate}-${status}`,
    planDate,
    code: stock.code,
    name: stock.name,
    sector: stock.sector,
    planType,
    status,
    originalSignal: stock.signal,
    finalSignal: invalidReason ? "wait" : stock.signal,
    shortTermScore: stock.shortTermScore.total,
    midTermScore: stock.midTermScore.total,
    totalScore: stock.totalScore,
    firstEntryLow: stock.tradeLevels.firstEntryLow,
    firstEntryHigh: stock.tradeLevels.firstEntryHigh,
    secondEntryLow: stock.tradeLevels.secondEntryLow,
    secondEntryHigh: stock.tradeLevels.secondEntryHigh,
    chaseLimit: stock.tradeLevels.chaseLimit,
    stopLoss: stock.tradeLevels.stopLoss,
    firstTarget: stock.tradeLevels.firstTarget,
    secondTarget: stock.tradeLevels.secondTarget,
    riskRewardRatio: stock.tradeLevels.riskRewardRatio,
    suggestedPositionPercent: suggestedPosition(stock.totalScore, stock.riskLevel),
    thesis: decision.summary,
    reasons: [...stock.shortTermScore.reasons, ...stock.midTermScore.reasons].slice(0, 8),
    warnings: [
      ...stock.shortTermScore.warnings,
      ...stock.midTermScore.warnings,
      "演示计划不构成投资建议",
    ],
    invalidReason,
    marketDataMode: meta?.mode ?? "mock",
    marketDataSource: meta?.source ?? "mock-analysis",
    marketTimestamp: meta?.marketTimestamp ?? `${planDate}T07:00:00.000Z`,
    calculatedAt: stock.shortTermScore.calculatedAt,
    isDemo: meta?.isDemo ?? true,
    snapshot: {
      quoteJson: JSON.stringify({
        code: stock.code,
        name: stock.name,
        price: stock.currentPrice,
        changePercent: stock.changePercent,
      }),
      indicatorsJson: JSON.stringify(stock.indicators),
      shortScoreJson: JSON.stringify(stock.shortTermScore),
      midScoreJson: JSON.stringify(stock.midTermScore),
      tradeLevelsJson: JSON.stringify(stock.tradeLevels),
      dataStatus,
      dataSource: meta?.source ?? "mock-analysis",
      isDemo: meta?.isDemo ?? true,
    },
  };
}

function suggestedPosition(totalScore: number, riskLevel: StockAnalysis["riskLevel"]) {
  if (riskLevel === "high") return 5;
  if (totalScore >= 90) return 25;
  if (totalScore >= 85) return 20;
  if (totalScore >= 75) return 12;
  return 5;
}
