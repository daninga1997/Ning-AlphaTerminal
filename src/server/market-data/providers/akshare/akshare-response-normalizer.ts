import type {
  MarketDailyBar,
  MarketDataStatus,
  MinuteBar,
  StockQuote,
} from "../../../../types/market-data";

type AkShareMeta = {
  status?: MarketDataStatus;
  source?: string;
  market_timestamp?: string | null;
  received_at?: string;
  is_demo?: boolean;
  strategyUsed?: string | null;
  attemptedStrategies?: Array<Record<string, unknown>>;
  upstreamErrorCode?: string | null;
};

type AkSharePayload<T> = {
  success: true;
  data: T;
  meta?: AkShareMeta;
};

export function normalizeAkShareQuoteResponse(payload: AkSharePayload<StockQuote[]>): StockQuote[] {
  return payload.data.map((quote) => ({
    ...quote,
    status: quote.status ?? payload.meta?.status ?? "unavailable",
    source: quote.source ?? payload.meta?.source ?? "akshare",
    isDemo: quote.isDemo ?? false,
    strategyUsed: quote.strategyUsed ?? payload.meta?.strategyUsed ?? null,
    upstreamErrorCode: quote.upstreamErrorCode ?? payload.meta?.upstreamErrorCode ?? null,
  }));
}

export function normalizeAkShareDailyBarsResponse(payload: AkSharePayload<MarketDailyBar[]>): MarketDailyBar[] {
  return payload.data.map((bar) => ({
    ...bar,
    source: bar.source ?? payload.meta?.source ?? "akshare",
    isDemo: bar.isDemo ?? false,
  }));
}

export function normalizeAkShareMinuteBarsResponse(payload: AkSharePayload<MinuteBar[]>): MinuteBar[] {
  return payload.data.map((bar) => ({
    ...bar,
    status: bar.status ?? payload.meta?.status ?? "unavailable",
    source: bar.source ?? payload.meta?.source ?? "akshare",
    receivedAt: bar.receivedAt ?? payload.meta?.received_at ?? new Date().toISOString(),
    isDemo: bar.isDemo ?? false,
    isReplay: false,
  }));
}
