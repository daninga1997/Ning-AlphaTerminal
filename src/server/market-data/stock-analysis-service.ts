import type { DailyBar } from "../../types/market";
import type { MarketDataMeta, StockQuote } from "../../types/market-data";
import type { StockAnalysis } from "../../types/stock";
import { mockStocks } from "../../data/mock-stocks";
import { calculateIndicators } from "../../lib/indicators";
import { calculateMidTermScore } from "../../lib/scoring/mid-term-score";
import { calculateShortTermScore } from "../../lib/scoring/short-term-score";
import { calculateTradeLevels } from "../../lib/trading/trade-levels";
import { MarketDataService } from "./market-data-service";
import { applyMarketDataSafetyGuard } from "./scoring-safety";

export type MarketBackedStockAnalysis = StockAnalysis & {
  marketDataMeta: MarketDataMeta;
};

export type StockDetailMarketData = {
  stock: MarketBackedStockAnalysis;
  bars: DailyBar[];
};

type StockDetailDataService = Pick<MarketDataService, "getQuote" | "getDailyBars">;

function quoteToStockAnalysis(
  quote: StockQuote,
  bars: DailyBar[],
  meta: MarketDataMeta,
): MarketBackedStockAnalysis | null {
  const stock = mockStocks.find((item) => item.code === quote.code);
  if (!stock) return null;

  const indicators = calculateIndicators(bars);
  const tradeLevels = calculateTradeLevels(bars, indicators);
  const shortTermScore = calculateShortTermScore({
    indicators,
    tradeLevels,
    sectorScore: stock.sectorScore,
  });
  const midTermScore = calculateMidTermScore({
    indicators,
    sectorScore: stock.sectorScore,
  });
  const totalScore = Math.round(shortTermScore.total * 0.55 + midTermScore.total * 0.45);
  const guard = applyMarketDataSafetyGuard({
    signal: stock.signal,
    status: meta.status,
    isDemo: meta.isDemo,
  });

  return {
    ...stock,
    currentPrice: quote.price,
    changePercent: quote.changePercent,
    turnover: quote.amount / 100_000_000,
    volumeRatio: quote.volumeRatio,
    turnoverRate: quote.turnoverRate,
    signal: guard.signal,
    shortTermScore,
    midTermScore,
    totalScore,
    tradeLevels,
    indicators,
    dataUpdatedAt: meta.marketTimestamp ?? quote.marketTimestamp,
    marketDataMeta: meta,
  };
}

function convertBars(
  bars: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    amount: number;
  }[],
): DailyBar[] {
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

export async function getStockDetailFromMarketData(
  code: string,
  service: StockDetailDataService = new MarketDataService(),
): Promise<StockDetailMarketData | null> {
  const [quoteResult, barsResult] = await Promise.all([service.getQuote(code), service.getDailyBars(code)]);
  if (!quoteResult.success || !barsResult.success) return null;

  const bars = convertBars(barsResult.data);
  const stock = quoteToStockAnalysis(quoteResult.data, bars, quoteResult.meta);
  return stock ? { stock, bars } : null;
}

export async function analyzeStockFromMarketData(code: string): Promise<MarketBackedStockAnalysis | null> {
  return (await getStockDetailFromMarketData(code))?.stock ?? null;
}

export async function getLegacyDailyBarsFromMarketData(code: string): Promise<DailyBar[] | null> {
  const service = new MarketDataService();
  const barsResult = await service.getDailyBars(code);
  if (!barsResult.success) return null;
  return convertBars(barsResult.data);
}

export async function analyzeAllStocksFromMarketData(): Promise<MarketBackedStockAnalysis[]> {
  const service = new MarketDataService();
  const codes = mockStocks.map((stock) => stock.code);
  const quotesResult = await service.getQuotes(codes);
  if (!quotesResult.success) return [];

  const analyses = await Promise.all(
    quotesResult.data.map(async (quote) => {
      const barsResult = await service.getDailyBars(quote.code);
      if (!barsResult.success) return null;
      return quoteToStockAnalysis(quote, convertBars(barsResult.data), quotesResult.meta);
    }),
  );

  return analyses.filter((stock): stock is MarketBackedStockAnalysis => stock !== null);
}
