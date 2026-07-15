import type { StrategyInput } from "../types/strategy";
import type { WatchZone } from "../types/trade-plan";
import { tradeLevelConfig } from "../config/trade-level-config";
import { round2 } from "../scoring/score-utils";
import { collectSupports, clusterSupports } from "./support-resistance";

export function calculateWatchZone(input: StrategyInput): WatchZone {
  const supports = clusterSupports(collectSupports(input));
  if (supports.length === 0) {
    return { low: 0, high: 0, basis: [], confidence: "unavailable", invalidReason: "日线数据不足，无法形成关注区", supports: [] };
  }
  const weighted = supports.reduce((sum, item) => sum + item.price * item.weight, 0) / supports.reduce((sum, item) => sum + item.weight, 0);
  const width = weighted * (tradeLevelConfig.watchZoneWidthPercent / 100);
  return {
    low: round2(weighted - width),
    high: round2(weighted + width),
    basis: supports.map((item) => `${item.label}:${item.price}`),
    confidence: supports.length >= 3 ? "medium" : "low",
    invalidReason: null,
    supports,
  };
}
