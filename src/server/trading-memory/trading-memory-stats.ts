import type { MarketDataMode } from "@/types/market-data";
import type { TradingPlanRecord } from "./trading-plan-repository";

const winOutcomes = new Set(["first_target", "second_target", "manual_exit"]);
const completedOutcomes = new Set(["stopped_out", "first_target", "second_target", "manual_exit", "expired"]);

export function calculateTradingMemoryStats(
  plans: TradingPlanRecord[],
  options: { marketDataMode?: MarketDataMode; includeDemo?: boolean } = {},
) {
  const mode = options.marketDataMode ?? "mock";
  const includeDemo = options.includeDemo ?? true;
  const scoped = plans.filter((plan) => plan.marketDataMode === mode && (includeDemo || !plan.isDemo));
  const completedPlans = scoped.filter((plan) => ["completed", "cancelled", "invalidated", "expired"].includes(plan.status));
  const reviewed = completedPlans.filter((plan) => plan.review && completedOutcomes.has(plan.review.outcome));
  const wins = reviewed.filter((plan) => plan.review && winOutcomes.has(plan.review.outcome));
  const triggeredPlans = scoped.filter((plan) => ["triggered", "completed"].includes(plan.status));
  const gains = reviewed.map((plan) => plan.review?.returnPercent ?? 0).filter((value) => value > 0);
  const losses = reviewed.map((plan) => plan.review?.returnPercent ?? 0).filter((value) => value < 0);
  const avg = (values: number[]) =>
    values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
  const averageGainPercent = avg(gains);
  const averageLossPercent = avg(losses);

  return {
    totalPlans: scoped.length,
    triggeredPlans: triggeredPlans.length,
    notTriggeredPlans: scoped.filter((plan) => plan.review?.outcome === "not_triggered").length,
    completedPlans: completedPlans.length,
    stoppedOutPlans: scoped.filter((plan) => plan.review?.outcome === "stopped_out").length,
    firstTargetReached: scoped.filter((plan) => plan.review?.outcome === "first_target").length,
    secondTargetReached: scoped.filter((plan) => plan.review?.outcome === "second_target").length,
    executionRate: scoped.length ? Number(((triggeredPlans.length / scoped.length) * 100).toFixed(2)) : 0,
    winRate: reviewed.length ? Number(((wins.length / reviewed.length) * 100).toFixed(2)) : 0,
    averageReturnPercent: avg(reviewed.map((plan) => plan.review?.returnPercent ?? 0)),
    averageGainPercent,
    averageLossPercent,
    averageProfitLossRatio:
      averageLossPercent === 0 ? 0 : Number(Math.abs(averageGainPercent / averageLossPercent).toFixed(2)),
    averageHoldingDays: avg(reviewed.map((plan) => plan.review?.holdingDays ?? 0)),
    maxSingleDrawdownPercent: reviewed.length
      ? Math.min(...reviewed.map((plan) => plan.review?.maxAdverseExcursionPercent ?? 0))
      : 0,
    byPlanType: groupCount(scoped, (plan) => plan.planType),
    bySector: groupCount(scoped, (plan) => plan.sector),
    marketDataMode: mode,
    smallSampleWarning: reviewed.length < 20,
    notes: ["胜率不等于模型未来成功概率", "open计划不计入已完成统计", "not_triggered不计入盈亏胜率"],
  };
}

function groupCount<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}
