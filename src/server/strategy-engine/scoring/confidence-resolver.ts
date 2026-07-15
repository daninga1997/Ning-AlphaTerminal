import type { StrategyConfidence } from "../types/strategy";

export function resolveConfidence(input: { score: number; invalidReasons: string[]; warnings: string[]; dataPartial: boolean; supportingCount?: number }): StrategyConfidence {
  if (input.invalidReasons.length > 0) return "unavailable";
  if (input.dataPartial) return "low";
  if (input.score >= 80 && (input.supportingCount ?? 0) > 0) return "high";
  if (input.score >= 65) return "medium";
  return "low";
}
