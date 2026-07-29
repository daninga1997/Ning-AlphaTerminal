export type MarketDataMode = "mock" | "replay" | "live";

export type MarketDataStatus =
  | "fresh"
  | "closed"
  | "delayed"
  | "stale"
  | "unavailable"
  | "partial"
  | "market_closed"
  | "historical_replay"
  | "rate_limited";

export type MinuteBarPeriod = "1m" | "5m" | "15m" | "30m" | "60m";

export type TradingSession =
  | "premarket"
  | "auction"
  | "morning"
  | "lunch_break"
  | "afternoon"
  | "closed"
  | "non_trading_day";

export type Exchange = "SZSE";

export interface StockQuote {
  code: string;
  name: string;
  exchange: Exchange;
  /** CNY/share */
  price: number;
  /** CNY/share */
  previousClose: number;
  /** CNY/share */
  open: number;
  /** CNY/share */
  high: number;
  /** CNY/share */
  low: number;
  /** CNY/share */
  change: number;
  /** percent, e.g. 1.23 means +1.23% */
  changePercent: number;
  /** shares */
  volume: number;
  /** CNY */
  amount: number;
  /** percent */
  turnoverRate: number;
  /** multiple of average volume */
  volumeRatio: number;
  /** CNY/share */
  bidPrice: number;
  /** CNY/share */
  askPrice: number;
  /** ISO timestamp in Asia/Shanghai market time */
  marketTimestamp: string;
  /** ISO timestamp when server received data */
  receivedAt: string;
  status: MarketDataStatus;
  source: string;
  isDemo: boolean;
  strategyUsed?: string | null;
  upstreamErrorCode?: string | null;
}

export interface MarketDailyBar {
  code: string;
  date: string;
  /** CNY/share */
  open: number;
  /** CNY/share */
  high: number;
  /** CNY/share */
  low: number;
  /** CNY/share */
  close: number;
  /** CNY/share */
  previousClose: number;
  /** shares */
  volume: number;
  /** CNY */
  amount: number;
  /** percent */
  turnoverRate: number;
  status?: MarketDataStatus;
  source: string;
  isDemo: boolean;
}

export interface MinuteBar {
  code: string;
  /** ISO timestamp in Asia/Shanghai market time */
  timestamp: string;
  /** CNY/share */
  open: number;
  /** CNY/share */
  high: number;
  /** CNY/share */
  low: number;
  /** CNY/share */
  close: number;
  /** shares */
  volume: number;
  /** CNY */
  amount: number;
  /** CNY/share */
  averagePrice: number;
  /** CNY/share */
  previousClose: number;
  source: string;
  receivedAt: string;
  status: MarketDataStatus;
  isDemo: boolean;
  isReplay?: boolean;
}

export interface SectorSnapshot {
  id: string;
  name: string;
  /** percent */
  changePercent: number;
  leadingStocks: string[];
  /** 0-100 */
  strengthScore: number;
  marketTimestamp: string;
  receivedAt: string;
  status: MarketDataStatus;
  source: string;
  isDemo: boolean;
}

export interface MarketOverview {
  tradingSession: TradingSession;
  marketTimestamp: string;
  receivedAt: string;
  status: MarketDataStatus;
  /** CNY */
  totalAmount: number;
  advancingCount: number;
  decliningCount: number;
  unchangedCount: number;
  limitUpCount: number;
  limitDownCount: number;
  /** 0-100 */
  marketScore: number;
  source: string;
  isDemo: boolean;
}

export interface MarketDataMeta {
  source: string;
  status: MarketDataStatus;
  marketTimestamp: string | null;
  receivedAt: string;
  isDemo: boolean;
  mode?: MarketDataMode;
  isReplay?: boolean;
  delayedSeconds?: number;
  period?: MinuteBarPeriod;
  strategyUsed?: string | null;
  attemptedStrategies?: Array<Record<string, unknown>>;
  upstreamErrorCode?: string | null;
}

export interface MarketDataSuccess<T> {
  success: true;
  data: T;
  meta: MarketDataMeta;
}

export interface MarketDataFailure {
  success: false;
  error: {
    code: string;
    message: string;
  };
  meta?: MarketDataMeta;
}

export type MarketDataResult<T> = MarketDataSuccess<T> | MarketDataFailure;
