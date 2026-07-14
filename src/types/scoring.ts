export type ShortTermGrade = "A" | "B" | "C" | "D";
export type MidTermGrade = "strong" | "holding" | "watch" | "weak";

export interface ScoreBreakdownItem {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  reason: string;
  isDemoInput?: boolean;
}

export interface ScoreResult<TGrade extends string> {
  total: number;
  grade: TGrade;
  breakdown: ScoreBreakdownItem[];
  reasons: string[];
  warnings: string[];
  calculatedAt: string;
}

export interface TradeLevels {
  firstEntryLow: number;
  firstEntryHigh: number;
  secondEntryLow: number;
  secondEntryHigh: number;
  chaseLimit: number;
  stopLoss: number;
  firstTarget: number;
  secondTarget: number;
  riskRewardRatio: number;
  invalidReason: string | null;
}
