export type FactorBreakdownItem = {
  id: string;
  name: string;
  rawValue: number | string | boolean | null;
  score: number;
  maxScore: number;
  source: string;
  reason: string;
};

export function factor(id: string, name: string, rawValue: FactorBreakdownItem["rawValue"], score: number, maxScore: number, source: string, reason: string): FactorBreakdownItem {
  return { id, name, rawValue, score: Math.max(0, Math.min(maxScore, Math.round(score))), maxScore, source, reason };
}
