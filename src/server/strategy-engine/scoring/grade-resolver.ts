import type { StrategyGrade } from "../types/strategy";

export function resolveGrade(score: number): StrategyGrade {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 45) return "C";
  return "D";
}
