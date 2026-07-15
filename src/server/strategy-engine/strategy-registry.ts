import { leaderFirstYinStrategy } from "./strategies/leader-first-yin-strategy";
import { lateSessionMomentumStrategy } from "./strategies/late-session-momentum-strategy";
import { trendSwingStrategy } from "./strategies/trend-swing-strategy";
import type { StrategyDefinition, StrategyId } from "./types/strategy";

export type StrategyQuery = "all" | "leader_first_yin" | "late_session_momentum" | "trend_swing" | StrategyId;

export const strategyRegistry: StrategyDefinition[] = [
  leaderFirstYinStrategy,
  lateSessionMomentumStrategy,
  trendSwingStrategy,
];

export function getStrategies(query: StrategyQuery = "all"): StrategyDefinition[] {
  if (query === "all") return strategyRegistry;
  const normalized = normalizeStrategyQuery(query);
  return strategyRegistry.filter((strategy) => strategy.id === normalized);
}

export function normalizeStrategyQuery(query: StrategyQuery): StrategyId {
  switch (query) {
    case "leader_first_yin":
    case "leader_first_yin_v1":
      return "leader_first_yin_v1";
    case "late_session_momentum":
    case "late_session_momentum_v1":
      return "late_session_momentum_v1";
    case "trend_swing":
    case "trend_swing_v1":
      return "trend_swing_v1";
    default:
      throw new Error(`Unsupported strategy: ${query}`);
  }
}
