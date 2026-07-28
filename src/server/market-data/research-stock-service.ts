import type { DailyBar } from "../../types/market";
import type { MarketDailyBar, MarketDataMeta, StockQuote } from "../../types/market-data";
import type { StrategyAction } from "../../types/strategy-action";
import { watchlistCodes } from "../market-sync/sector-mapping";
import { isAllowedStockCode } from "./market-data-errors";
import { MarketDataService } from "./market-data-service";
import { applyStrategyGatekeeper } from "./strategy-gatekeeper";

type ResearchDataService = Pick<MarketDataService, "getQuote" | "getDailyBars">;

export type ResearchStockDetail = {
  quote: StockQuote;
  quoteMeta: MarketDataMeta;
  bars: DailyBar[];
  dailyBarsMeta: MarketDataMeta;
  isCoreWatchlist: boolean;
  strategyAction: StrategyAction;
  dataBlockers: string[];
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

  const bars = dailyBarsResult.success ? toDailyBars(dailyBarsResult.data) : [];
  const quote = quoteResult.data;
  const dailyBarsMeta: MarketDataMeta = dailyBarsResult.success
    ? dailyBarsResult.meta
    : {
        source: quote.source,
        status: "unavailable",
        marketTimestamp: null,
        receivedAt: quote.receivedAt,
        isDemo: false,
        mode: quoteResult.meta.mode,
        upstreamErrorCode: dailyBarsResult.error.code,
      };

  // 策略门卫
  const keeper = applyStrategyGatekeeper(
    bars.length,
    quoteResult.success,
    "wait",     // 默认信号（外部股票先按wait处理，后续可接入真实策略引擎）
    "markup",    // 默认趋势阶段
    70,          // 默认评分（后续接入策略引擎后可改为真实评分）
  );

  return {
    quote,
    quoteMeta: quoteResult.meta,
    bars,
    dailyBarsMeta,
    isCoreWatchlist: watchlistCodes.includes(code),
    strategyAction: keeper.action,
    dataBlockers: keeper.blockers,
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