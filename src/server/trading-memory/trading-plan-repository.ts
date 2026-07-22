import type { MarketDataMode } from "@/types/market-data";
import type { StockSignal } from "@/types/stock";

export type PlanType = "short_term" | "swing" | "mid_term";
export type TradingPlanStatus =
  | "draft"
  | "active"
  | "triggered"
  | "cancelled"
  | "invalidated"
  | "completed"
  | "expired";

export type PlanEventType =
  | "created"
  | "activated"
  | "entry_zone_touched"
  | "chase_limit_exceeded"
  | "stop_loss_broken"
  | "first_target_reached"
  | "second_target_reached"
  | "signal_changed"
  | "data_became_stale"
  | "data_unavailable"
  | "cancelled"
  | "invalidated"
  | "completed"
  | "manual_note";

export type ReviewOutcome =
  | "not_triggered"
  | "cancelled"
  | "stopped_out"
  | "first_target"
  | "second_target"
  | "manual_exit"
  | "expired"
  | "open";

export type SnapshotInput = {
  quoteJson: string;
  indicatorsJson: string;
  shortScoreJson: string;
  midScoreJson: string;
  tradeLevelsJson: string;
  dataStatus: "fresh" | "closed" | "delayed" | "stale" | "unavailable" | "partial" | "market_closed" | "historical_replay" | "rate_limited";
  dataSource: string;
  isDemo: boolean;
};

export type SignalSnapshotRecord = SnapshotInput & {
  id: string;
  tradingPlanId: string;
  snapshotTime: string;
  createdAt: string;
};

export type PlanEventRecord = {
  id: string;
  tradingPlanId: string;
  eventType: PlanEventType;
  eventTime: string;
  price: number | null;
  description: string;
  source: string;
  metadata: string;
  createdAt: string;
};

export type PlanReviewRecord = {
  id: string;
  tradingPlanId: string;
  reviewDate: string;
  outcome: ReviewOutcome;
  entryPrice: number | null;
  exitPrice: number | null;
  highestPrice: number | null;
  lowestPrice: number | null;
  returnPercent: number;
  maxFavorableExcursionPercent: number;
  maxAdverseExcursionPercent: number;
  holdingDays: number;
  followedPlan: boolean;
  executionNotes: string;
  whatWorked: string;
  whatFailed: string;
  lesson: string;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
};

export type TradingPlanCore = {
  idempotencyKey: string;
  planDate: string;
  code: string;
  name: string;
  sector: string;
  planType: PlanType;
  status: TradingPlanStatus;
  originalSignal: StockSignal;
  finalSignal: StockSignal;
  shortTermScore: number;
  midTermScore: number;
  totalScore: number;
  firstEntryLow: number;
  firstEntryHigh: number;
  secondEntryLow: number;
  secondEntryHigh: number;
  chaseLimit: number;
  stopLoss: number;
  firstTarget: number;
  secondTarget: number;
  riskRewardRatio: number;
  suggestedPositionPercent: number;
  thesis: string;
  reasons: string[];
  warnings: string[];
  invalidReason: string | null;
  marketDataMode: MarketDataMode;
  marketDataSource: string;
  marketTimestamp: string;
  calculatedAt: string;
  isDemo: boolean;
};

export type CreateTradingPlanInput = TradingPlanCore & {
  snapshot: SnapshotInput;
};

export type TradingPlanRecord = TradingPlanCore & {
  id: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  events: PlanEventRecord[];
  review: PlanReviewRecord | null;
  snapshot: SignalSnapshotRecord | null;
};

export type PlanReviewInput = Omit<
  PlanReviewRecord,
  "id" | "tradingPlanId" | "createdAt" | "updatedAt" | "returnPercent" | "maxFavorableExcursionPercent" | "maxAdverseExcursionPercent"
> & {
  returnPercent?: number;
  maxFavorableExcursionPercent?: number;
  maxAdverseExcursionPercent?: number;
};

export type MemoryPlanFilters = {
  query?: string;
  date?: string;
  sector?: string;
  planType?: PlanType | "all";
  status?: TradingPlanStatus | "all";
  outcome?: ReviewOutcome | "all";
  marketDataMode?: MarketDataMode | "all";
  reviewed?: "all" | "yes" | "no";
};

export interface TradingMemoryRepository {
  createPlan(input: CreateTradingPlanInput): Promise<TradingPlanRecord>;
  findPlanById(id: string): Promise<TradingPlanRecord | null>;
  listPlans(filters?: MemoryPlanFilters): Promise<TradingPlanRecord[]>;
  updatePlanStatus(id: string, status: TradingPlanStatus, finalSignal?: StockSignal): Promise<TradingPlanRecord | null>;
  addEvent(input: {
    tradingPlanId: string;
    eventType: PlanEventType;
    eventTime?: string;
    price?: number | null;
    description: string;
    source?: string;
    metadata?: string;
  }): Promise<PlanEventRecord>;
  addReview(tradingPlanId: string, input: PlanReviewInput): Promise<PlanReviewRecord>;
}
