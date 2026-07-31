import type { StrategyInput } from "./types/strategy";

export function commonDataInvalidReasons(input: StrategyInput, options: { needsDaily?: number; needsMinute?: boolean; shortTerm?: boolean } = {}): string[] {
  const reasons: string[] = [];
  if (!/^(000|001|002|003)\d{3}$/.test(input.code)) reasons.push("非深市主板观察范围");
  if (!input.quote) reasons.push("Quote缺失");
  if (options.needsDaily && input.dailyBars.length < options.needsDaily) reasons.push(`日线少于${options.needsDaily}根`);
  if (options.needsMinute && input.minuteBars.length === 0) reasons.push("分钟线缺失");
  if (input.integrityReport.permission !== "full" && input.integrityReport.permission !== "demo") {
    reasons.push("数据权限不是full，不能生成新的buy_allowed");
  }
  if (input.integrityReport.status === "partial" && options.shortTerm) reasons.push("数据partial，短线策略受限");
  return reasons;
}

export function hasMockLiveMixed(input: StrategyInput): boolean {
  return input.quote?.isDemo === true && input.integrityReport.marketDataMode === "live";
}
