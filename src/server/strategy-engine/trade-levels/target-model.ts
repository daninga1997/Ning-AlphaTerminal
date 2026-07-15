import type { StrategyInput } from "../types/strategy";
import type { EntryPlan, PriceLevel } from "../types/trade-plan";
import { tradeLevelConfig } from "../config/trade-level-config";
import { round2 } from "../scoring/score-utils";

export function calculateRiskReward(entry: EntryPlan, stopLoss: PriceLevel, firstTarget: PriceLevel): number {
  const risk = entry.plannedEntryPrice - stopLoss.price;
  const reward = firstTarget.price - entry.plannedEntryPrice;
  if (risk <= 0) return 0;
  return round2(reward / risk);
}

export function calculateTargets(input: StrategyInput, entry: EntryPlan, stopLoss: PriceLevel) {
  const recentHigh = Math.max(...input.dailyBars.slice(-60).map((bar) => bar.high));
  const risk = Math.max(0.01, entry.plannedEntryPrice - stopLoss.price);
  const firstTarget: PriceLevel = {
    price: round2(Math.max(recentHigh, entry.plannedEntryPrice + risk * tradeLevelConfig.firstTargetRiskReward)),
    basis: ["风险收益比1.6", "最近60日前高"],
  };
  const secondTarget: PriceLevel = {
    price: round2(Math.max(firstTarget.price + risk, entry.plannedEntryPrice + risk * tradeLevelConfig.secondTargetRiskReward)),
    basis: ["风险收益比2.6", "趋势延伸目标"],
  };
  return {
    firstTarget,
    secondTarget,
    trailingExitRule: "跌破MA10减仓，跌破MA20或策略止损结构失效退出",
  };
}
