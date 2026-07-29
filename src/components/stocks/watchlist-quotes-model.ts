import type { MarketDataMeta, StockQuote } from "../../types/market-data";
import type { StockAnalysis } from "../../types/stock";

export type QuoteRefreshPayload = {
  data: StockQuote[];
  meta: MarketDataMeta;
};

function quoteMetaFromPayload(payload: QuoteRefreshPayload, quote: StockQuote): MarketDataMeta {
  return {
    ...payload.meta,
    source: quote.source || payload.meta.source,
    status: quote.status || payload.meta.status,
    marketTimestamp: quote.marketTimestamp || payload.meta.marketTimestamp,
    receivedAt: quote.receivedAt || payload.meta.receivedAt,
    isDemo: quote.isDemo,
    strategyUsed: quote.strategyUsed ?? payload.meta.strategyUsed ?? null,
    upstreamErrorCode: quote.upstreamErrorCode ?? payload.meta.upstreamErrorCode ?? null,
  };
}

export function mergeQuoteRefreshResult(stocks: StockAnalysis[], payload: QuoteRefreshPayload): StockAnalysis[] {
  const quotesByCode = new Map(payload.data.map((quote) => [quote.code, quote]));
  return stocks.map((stock) => {
    const quote = quotesByCode.get(stock.code);
    if (!quote) return stock;
    return {
      ...stock,
      currentPrice: quote.price,
      changePercent: quote.changePercent,
      turnover: quote.amount / 100_000_000,
      volumeRatio: quote.volumeRatio,
      turnoverRate: quote.turnoverRate,
      dataUpdatedAt: quote.marketTimestamp,
      marketDataMeta: quoteMetaFromPayload(payload, quote),
    };
  });
}

export function applyQuoteRefreshFailure(stocks: StockAnalysis[]): StockAnalysis[] {
  return stocks.map((stock) => {
    const currentMeta = stock.marketDataMeta;
    const hasRealQuote = currentMeta && currentMeta.isDemo === false && currentMeta.status !== "unavailable";
    return {
      ...stock,
      marketDataMeta: {
        source: currentMeta?.source ?? "tencent",
        status: hasRealQuote ? "stale" : "unavailable",
        marketTimestamp: currentMeta?.marketTimestamp ?? null,
        receivedAt: currentMeta?.receivedAt ?? new Date().toISOString(),
        isDemo: !hasRealQuote,
        mode: currentMeta?.mode ?? "live",
        strategyUsed: currentMeta?.strategyUsed ?? null,
        upstreamErrorCode: currentMeta?.upstreamErrorCode ?? "QUOTE_REFRESH_FAILED",
      },
    };
  });
}
