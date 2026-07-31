import { factor } from "../types/factor";
import type { FactorBreakdownItem } from "../types/factor";
import type { StrategyInput } from "../types/strategy";
import { commonStrategyConfig } from "../config/common-strategy-config";

export function getMarketScore(input: StrategyInput): number {
  return input.marketOverview?.marketScore ?? 0;
}

export function getMarketPositionCap(input: StrategyInput): number {
  const score = getMarketScore(input);
  if (input.marketOverview?.dataStatus === "partial" || input.integrityReport.status === "partial") return commonStrategyConfig.marketScore.partialPositionCap;
  if (score < 40) return 10;
  if (score < 55) return 10;
  if (score < 70) return 30;
  if (score < 85) return 50;
  return 70;
}

export function marketFactor(input: StrategyInput, maxScore: number): FactorBreakdownItem {
  const score = getMarketScore(input);
  return factor("market_environment", "市场环境", score, Math.min(maxScore, Math.round((score / 100) * maxScore)), maxScore, input.marketOverview?.source ?? "missing", `市场评分 ${score}`);
}

export function marketInvalidReasons(input: StrategyInput, shortTerm: boolean): string[] {
  const reasons: string[] = [];
  const score = getMarketScore(input);
  if (!input.marketOverview) reasons.push("市场概览缺失");
  if (score < 40 && shortTerm) reasons.push("市场评分低于40，禁止新增短线仓位");
  if (input.integrityReport.permission !== "full" && input.integrityReport.permission !== "demo") {
    reasons.push("数据权限不是full，不能生成新的buy_allowed");
  }
  return reasons;
}
