import type { StrategyId } from "../types/strategy";
import type { EntryPlan, PriceLevel } from "../types/trade-plan";
import type { StrategyInput } from "../types/strategy";
import { atr14 } from "../factors/trend-factors";
import { tradeLevelConfig } from "../config/trade-level-config";
import { round2 } from "../scoring/score-utils";

export function calculateStopLoss(input: StrategyInput, entry: EntryPlan, strategyId: StrategyId): PriceLevel {
  const recentLow = Math.min(...input.dailyBars.slice(-20).map((bar) => bar.low));
  const atr = atr14(input.dailyBars);
  const structural = strategyId === "late_session_momentum_v1" ? entry.low - atr * 0.8 : Math.min(recentLow * 0.99, entry.low - atr * tradeLevelConfig.stopAtrMultiplier);
  return {
    price: round2(Math.min(structural, entry.low - 0.01)),
    basis: strategyId === "late_session_momentum_v1" ? ["尾盘计划：跌破关键分时均价或入场区失效"] : ["最近有效低点", "入场区下沿", "ATR14缓冲"],
  };
}
