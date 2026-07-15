import type { MarketDataMode, MarketDataStatus } from "./market-data";

// ─── 完整性状态 ────────────────────────────────────────────

export type DataIntegrityStatus =
  | "complete"
  | "partial"
  | "stale"
  | "conflicting"
  | "unavailable"
  | "demo_only";

// ─── 问题代码 ──────────────────────────────────────────────

export type DataIntegrityIssueCode =
  | "WRONG_TRADING_DATE"
  | "MARKET_TIMESTAMP_MISSING"
  | "DATA_TOO_OLD"
  | "QUOTE_MISSING"
  | "DAILY_BARS_MISSING"
  | "MINUTE_BARS_MISSING"
  | "SECTOR_DATA_MISSING"
  | "MARKET_OVERVIEW_MISSING"
  | "SOURCE_CONFLICT"
  | "MODE_CONFLICT"
  | "PRICE_INVALID"
  | "OHLC_INVALID"
  | "VOLUME_INVALID"
  | "INSUFFICIENT_HISTORY"
  | "NON_TRADING_DAY"
  | "FUTURE_TIMESTAMP"
  | "MOCK_LIVE_MIXED"
  | "REPLAY_LIVE_MIXED"
  | "PROVIDER_UNAVAILABLE";

// ─── 策略类型 ──────────────────────────────────────────────

export type StrategyType =
  | "leader_first_yin"
  | "late_session_momentum"
  | "trend_swing"
  | "generic_short_term"
  | "generic_mid_term";

// ─── 交易决策权限 ──────────────────────────────────────────

export type TradeDecisionPermission =
  | "full"
  | "watch_only"
  | "historical_only"
  | "blocked";

// ─── 问题条目 ──────────────────────────────────────────────

export interface DataIntegrityIssue {
  code: DataIntegrityIssueCode;
  message: string;
  field?: string;
  isCritical: boolean;
}

// ─── 数据完整性报告 ────────────────────────────────────────

export interface DataIntegrityReport {
  code: string;
  requestedAt: string;
  latestTradingDate: string;
  quoteTradingDate: string | null;
  dailyBarsLatestDate: string | null;
  minuteBarsLatestDate: string | null;
  marketTimestamp: string | null;
  receivedAt: string;
  quoteSource: string | null;
  dailySource: string | null;
  minuteSource: string | null;
  marketDataMode: MarketDataMode;
  status: DataIntegrityStatus;
  permission: TradeDecisionPermission;
  completenessPercent: number;
  issues: DataIntegrityIssue[];
  warnings: DataIntegrityIssue[];
  validatedAt: string;
  canGenerateScore: boolean;
  canGenerateWatchZone: boolean;
  canGenerateEntryPrice: boolean;
  canGenerateBuySignal: boolean;
  canGenerateTradePlan: boolean;
}

// ─── 分析上下文 ────────────────────────────────────────────

export interface AnalysisContext {
  code: string;
  analysisType: StrategyType | "market_overview" | "watchlist_scan";
  requestedAt: string;
  analysisTradingDate: string;
  quoteTimestamp: string | null;
  latestDailyBarDate: string | null;
  latestMinuteBarTimestamp: string | null;
  sources: {
    quote: string | null;
    daily: string | null;
    minute: string | null;
  };
  mode: MarketDataMode;
  completenessPercent: number;
  integrityStatus: DataIntegrityStatus;
  permission: TradeDecisionPermission;
  strategyVersion: string;
  scoringVersion: string;
  tradeLevelVersion: string;
}

// ─── 行情时间锁定 ──────────────────────────────────────────

export interface MarketTimeLock {
  systemTime: string;
  tradingSession: string;
  latestExpectedTradingDate: string;
  quoteDate: string | null;
  dailyBarsLatestDate: string | null;
  minuteBarsLatestTime: string | null;
  providerReceivedAt: string | null;
  dataMode: MarketDataMode;
  isWithinTradingHours: boolean;
  isPostMarket: boolean;
  canUseTodayDailyBars: boolean;
  expectedDailyBarsDate: string;
}

// ─── 数据来源一致性 ────────────────────────────────────────

export interface SourceConsistencyResult {
  isConsistent: boolean;
  issues: DataIntegrityIssue[];
  sources: {
    quote: { source: string; mode: MarketDataMode; isDemo: boolean } | null;
    daily: { source: string; mode: MarketDataMode; isDemo: boolean } | null;
    minute: { source: string; mode: MarketDataMode; isDemo: boolean } | null;
  };
}

// ─── 完整度输入 ────────────────────────────────────────────

export interface CompletenessInput {
  hasValidQuote: boolean;
  hasValidDailyBars: boolean;
  hasValidMinuteBars: boolean;
  hasValidSector: boolean;
  hasValidMarketOverview: boolean;
  isSourceConsistent: boolean;
  criticalIssues: DataIntegrityIssueCode[];
}

// ─── API响应 ───────────────────────────────────────────────

export interface DataIntegrityApiResponse {
  success: true;
  data: {
    status: DataIntegrityStatus;
    permission: TradeDecisionPermission;
    completenessPercent: number;
    latestTradingDate: string;
    issues: Array<{ code: DataIntegrityIssueCode; message: string }>;
    warnings: Array<{ code: DataIntegrityIssueCode; message: string }>;
    canGenerateTradePlan: boolean;
    canGenerateScore: boolean;
    canGenerateWatchZone: boolean;
    canGenerateEntryPrice: boolean;
    canGenerateBuySignal: boolean;
  };
  meta: {
    validatedAt: string;
    sources: {
      quote: string | null;
      daily: string | null;
      minute: string | null;
    };
    mode: MarketDataMode;
  };
}

// ─── 审计日志条目 ──────────────────────────────────────────

export interface IntegrityAuditEntry {
  validatedAt: string;
  code: string;
  analysisTradingDate: string;
  status: DataIntegrityStatus;
  permission: TradeDecisionPermission;
  completenessPercent: number;
  issueCodes: DataIntegrityIssueCode[];
  sources: {
    quote: string | null;
    daily: string | null;
    minute: string | null;
  };
  strategyType?: StrategyType;
}