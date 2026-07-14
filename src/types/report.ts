export type ReportType = "premarket" | "intraday" | "postmarket";

export type ReportDataStatus = "fresh" | "delayed" | "stale" | "unavailable";

export type IntradayEventType =
  | "breakout"
  | "breakdown"
  | "volume_spike"
  | "sector_rotation"
  | "risk_alert";

export type PlanResult = "hit" | "pending" | "invalidated" | "avoided";

export interface ReportSector {
  name: string;
  rank: number;
  heat: number;
  summary: string;
}

export interface ReportStock {
  code: string;
  name: string;
  sector: string;
  level: "A" | "B" | "Watch" | "Risk";
  signal: "buy" | "wait" | "hold" | "reduce" | "avoid";
  score: number;
  trigger: string;
  chaseLimit: string;
  summary: string;
}

export interface IntradayEvent {
  type: IntradayEventType;
  stockName: string;
  stockCode: string;
  summary: string;
}

export interface ReportPlanReview {
  stockName: string;
  stockCode: string;
  result: PlanResult;
  summary: string;
}

export interface Report {
  id: string;
  type: ReportType;
  title: string;
  reportDate: string;
  generatedAt: string;
  marketStatus: string;
  marketScore: number;
  suggestedPosition: string;
  marketSummary: string;
  sectors: ReportSector[];
  stocks: ReportStock[];
  risks: string[];
  actionPlan: string[];
  dataStatus: ReportDataStatus;
  isDemo: boolean;
  intradayEvents?: IntradayEvent[];
  planReviews?: ReportPlanReview[];
  nextCheckAt?: string;
}
