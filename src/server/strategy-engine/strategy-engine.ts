import type { StrategyInput } from "./types/strategy";
import type { StrategyEngineOutput } from "./types/strategy-result";
import { generateAlphaTradePlan, detectStrategyConflicts } from "./trade-plan-generator";
import { getStrategies, type StrategyQuery } from "./strategy-registry";

export interface RunStrategyOptions {
  strategy?: StrategyQuery;
}

export function runAllStrategies(input: StrategyInput, options: RunStrategyOptions = {}): StrategyEngineOutput {
  const strategies = getStrategies(options.strategy ?? "all");
  const strategyResults = strategies.map((strategy) => strategy.run(input));
  const finalPlan = generateAlphaTradePlan(input, strategyResults);
  const conflicts = detectStrategyConflicts(strategyResults);

  return {
    strategyResults,
    finalPlan,
    conflicts,
  };
}
