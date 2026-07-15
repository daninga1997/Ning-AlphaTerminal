import type { StrategyId, StrategyInput } from "../types/strategy";
import type { EntryPlan, WatchZone } from "../types/trade-plan";
import { atr14 } from "../factors/trend-factors";
import { tradeLevelConfig } from "../config/trade-level-config";
import { round2 } from "../scoring/score-utils";

export function calculateChaseLimit(input: StrategyInput, watchZone: WatchZone) {
  const atr = atr14(input.dailyBars);
  const upper = watchZone.high || input.quote?.price || 0;
  const price = round2(upper + atr * tradeLevelConfig.chaseAtrMultiplier);
  const current = input.quote?.price ?? price;
  const distancePercent = current === 0 ? 0 : round2(((price - current) / current) * 100);
  return { price, basis: ["关注区上沿", "ATR14", `倍数${tradeLevelConfig.chaseAtrMultiplier}`], distancePercent };
}

export function buildEntryPlans(input: StrategyInput, watchZone: WatchZone, strategyId: StrategyId): EntryPlan[] {
  const atr = atr14(input.dailyBars);
  const basePosition = strategyId === "late_session_momentum_v1" ? 6 : 10;
  const first: EntryPlan = {
    type: strategyId === "late_session_momentum_v1" ? "late_session_entry" : "pullback_entry",
    low: round2(watchZone.low),
    high: round2(watchZone.high),
    plannedEntryPrice: round2((watchZone.low + watchZone.high) / 2),
    triggerConditions: strategyId === "late_session_momentum_v1" ? ["14:30后量能增强", "价格保持在分时均价上方"] : ["回踩关注区", "缩量企稳或放量转强"],
    cancellationConditions: ["跌破关注区且不能收回", "数据完整性降级"],
    suggestedPositionPercent: basePosition,
  };
  const secondHigh = round2(first.low - atr * 0.2);
  const secondLow = round2(first.low - atr * tradeLevelConfig.deepEntryAtrMultiplier);
  const second: EntryPlan = {
    type: "deep_pullback_entry",
    low: secondLow,
    high: secondHigh,
    plannedEntryPrice: round2((secondLow + secondHigh) / 2),
    triggerConditions: ["深回踩不破趋势结构", "MA20或平台支撑有效"],
    cancellationConditions: ["跌破MA20后放量走弱", "板块评分跌破40"],
    suggestedPositionPercent: Math.max(0, basePosition - 3),
  };
  const high20 = Math.max(...input.dailyBars.slice(-20).map((bar) => bar.high));
  const breakout: EntryPlan = {
    type: "breakout_entry",
    low: round2(high20 + atr * 0.1),
    high: round2(high20 + atr * 0.25),
    plannedEntryPrice: round2(high20 + atr * 0.15),
    triggerConditions: ["突破20日高点", "成交量高于20日均量1.2倍"],
    cancellationConditions: ["突破后回落平台内", "当前价超过突破追高上限"],
    suggestedPositionPercent: Math.max(0, basePosition - 4),
  };
  return strategyId === "late_session_momentum_v1" ? [first] : [first, second, breakout];
}
