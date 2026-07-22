import type { DailyBar } from "../../types/market";
import type { MarketDailyBar, MarketDataMeta, StockQuote } from "../../types/market-data";
import { watchlistCodes } from "../market-sync/sector-mapping";
import { isAllowedStockCode } from "./market-data-errors";
import { MarketDataService } from "./market-data-service";

type ResearchDataService = Pick<MarketDataService, "getQuote" | "getDailyBars">;

export type ResearchStockDetail = {
  quote: StockQuote;
  quoteMeta: MarketDataMeta;
  bars: DailyBar[];
  dailyBarsMeta: MarketDataMeta;
  isCoreWatchlist: boolean;
};

export async function getResearchStockDetail(
  code: string,
  service: ResearchDataService = new MarketDataService(),
): Promise<ResearchStockDetail | null> {
  if (!isAllowedStockCode(code)) return null;

  const [quoteResult, dailyBarsResult] = await Promise.all([
    service.getQuote(code),
    service.getDailyBars(code),
  ]);
  if (!quoteResult.success) return null;

  return {
    quote: quoteResult.data,
    quoteMeta: quoteResult.meta,
    bars: dailyBarsResult.success ? toDailyBars(dailyBarsResult.data) : [],
    dailyBarsMeta: dailyBarsResult.success
      ? dailyBarsResult.meta
      : {
          source: quoteResult.data.source,
          status: "unavailable",
          marketTimestamp: null,
          receivedAt: quoteResult.data.receivedAt,
          isDemo: false,
          mode: quoteResult.meta.mode,
          upstreamErrorCode: dailyBarsResult.error.code,
        },
    isCoreWatchlist: watchlistCodes.includes(code),
  };
}

function toDailyBars(bars: MarketDailyBar[]): DailyBar[] {
  return bars.map((bar) => ({
    date: bar.date,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    turnover: bar.amount / 100_000_000,
  }));
}
