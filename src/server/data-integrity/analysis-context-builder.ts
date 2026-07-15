import type { AnalysisContext, StrategyType, DataIntegrityStatus, TradeDecisionPermission } from "../../types/data-integrity";
import type { MarketDataMode } from "../../types/market-data";
import { getLatestExpectedTradingDate } from "../trading-calendar/trading-day-resolver";

export interface AnalysisContextInput {
  code: string;
  analysisType: StrategyType | "market_overview" | "watchlist_scan";
  quoteTimestamp: string | null;
  latestDailyBarDate: string | null;
  latestMinuteBarTimestamp: string | null;
  quoteSource: string | null;
  dailySource: string | null;
  minuteSource: string | null;
  mode: MarketDataMode;
  completenessPercent: number;
  integrityStatus: DataIntegrityStatus;
  permission: TradeDecisionPermission;
}

export function buildAnalysisContext(input: AnalysisContextInput): AnalysisContext {
  return {
    code: input.code,
    analysisType: input.analysisType,
    requestedAt: new Date().toISOString(),
    analysisTradingDate: getLatestExpectedTradingDate(new Date()),
    quoteTimestamp: input.quoteTimestamp,
    latestDailyBarDate: input.latestDailyBarDate,
    latestMinuteBarTimestamp: input.latestMinuteBarTimestamp,
    sources: {
      quote: input.quoteSource,
      daily: input.dailySource,
      minute: input.minuteSource,
    },
    mode: input.mode,
    completenessPercent: input.completenessPercent,
    integrityStatus: input.integrityStatus,
    permission: input.permission,
    strategyVersion: "v1",
    scoringVersion: "v1",
    tradeLevelVersion: "v1",
  };
}