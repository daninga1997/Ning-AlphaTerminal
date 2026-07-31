import type { DailyBar } from "../../types/market";
import type { MarketDataMeta, StockQuote } from "../../types/market-data";
import type { StockAnalysis } from "../../types/stock";
import { mockMarketHistory } from "../../data/mock-market-history";
import { mockStocks } from "../../data/mock-stocks";
import { calculateIndicators } from "../../lib/indicators";
import { calculateMidTermScore } from "../../lib/scoring/mid-term-score";
import { calculateShortTermScore } from "../../lib/scoring/short-term-score";
import { calculateTradeLevels } from "../../lib/trading/trade-levels";
import { MarketDataService } from "./market-data-service";
import { applyMarketDataSafetyGuard } from "./scoring-safety";

export type MarketBackedStockAnalysis = StockAnalysis & {
  marketDataMeta: MarketDataMeta;
  technicalDataMeta: MarketDataMeta;
};

export type StockDetailMarketData = {
  stock: MarketBackedStockAnalysis;
  bars: DailyBar[];
};

type StockDetailDataService = Pick<MarketDataService, "getQuote" | "getDailyBars">;

function deriveSignalFromScores(
  totalScore: number,
  indicators: ReturnType<typeof calculateIndicators>,
  changePercent: number,
  trendStage: import("../../types/stock").TrendStage,
): import("../../types/stock").StockSignal {
  if (totalScore >= 90) return "buy";
  if (totalScore >= 85) {
    if (trendStage === "breakout" || trendStage === "markup") return "buy";
    return "wait";
  }
  if (totalScore >= 70) {
    if (trendStage === "decline" || trendStage === "distribution") return "reduce";
    return "hold";
  }
  if (totalScore >= 55) {
    if (trendStage === "decline") return "avoid";
    return "wait";
  }
  return "avoid";
}

function deriveTrendStage(indicators: ReturnType<typeof calculateIndicators>): import("../../types/stock").TrendStage {
  if (indicators.macd === null) return "accumulation";
  if (indicators.macd.bullishCross && indicators.sma20 !== null && indicators.sma60 !== null && indicators.sma20 > indicators.sma60) return "breakout";
  if (indicators.sma20 !== null && indicators.sma60 !== null && indicators.sma20 > indicators.sma60) return "markup";
  if (indicators.kdj !== null && indicators.kdj.k > 85 && indicators.kdj.j > 100) return "distribution";
  if (indicators.change20 !== null && indicators.change20 < -8) return "decline";
  if (indicators.sma20 !== null && indicators.sma60 !== null && indicators.sma20 <= indicators.sma60) return "accumulation";
  return "markup";
}

function deriveRiskLevel(indicators: ReturnType<typeof calculateIndicators>, totalScore: number): import("../../types/stock").RiskLevel {
  if (totalScore < 55) return "high";
  if (indicators.atr14 !== null && indicators.sma20 !== null && indicators.atr14 / indicators.sma20 > 0.05) return "high";
  if (indicators.maxDrawdown !== null && indicators.maxDrawdown > 25) return "high";
  if (indicators.volumeRatio20 !== null && indicators.volumeRatio20 > 3) return "high";
  if (totalScore >= 80 && indicators.maxDrawdown !== null && indicators.maxDrawdown <= 15) return "low";
  return "medium";
}

function deriveSectorScore(indicators: ReturnType<typeof calculateIndicators>, changePercent: number): number {
  let score = 70;
  if (indicators.macd !== null && indicators.macd.histogram > 0) score += 10;
  if (indicators.sma20 !== null && indicators.sma60 !== null && indicators.sma20 > indicators.sma60) score += 10;
  if (changePercent > 2) score += 5;
  if (changePercent < -2) score -= 10;
  if (indicators.volumeRatio20 !== null && indicators.volumeRatio20 > 1.5) score += 5;
  return Math.min(100, Math.max(40, score));
}

function quoteToStockAnalysis(
  quote: StockQuote,
  bars: DailyBar[],
  meta: MarketDataMeta,
  technicalMeta: MarketDataMeta,
): MarketBackedStockAnalysis | null {
  const stock = mockStocks.find((item) => item.code === quote.code);
  if (!stock) return null;

  const indicators = calculateIndicators(bars);
  const tradeLevels = calculateTradeLevels(bars, indicators);
  const trendStage = deriveTrendStage(indicators);
  const dynamicSectorScore = deriveSectorScore(indicators, quote.changePercent);

  const shortTermScore = calculateShortTermScore({
    indicators,
    tradeLevels,
    sectorScore: dynamicSectorScore,
  });
  const midTermScore = calculateMidTermScore({
    indicators,
    sectorScore: dynamicSectorScore,
  });
  const totalScore = Math.round(shortTermScore.total * 0.55 + midTermScore.total * 0.45);
  const dynamicSignal = deriveSignalFromScores(totalScore, indicators, quote.changePercent, trendStage);
  const riskLevel = deriveRiskLevel(indicators, totalScore);

  const technicalInsufficient =
    meta.isDemo === false && (technicalMeta.status === "unavailable" || technicalMeta.status === "stale");
  const guard = applyMarketDataSafetyGuard({
    signal: dynamicSignal,
    status: technicalInsufficient ? "stale" : meta.status,
    isDemo: meta.isDemo,
  });
  const technicalWarning = technicalInsufficient ? "仅报价可用，技术确认不足。" : null;

  const computedVolumeRatio =
    quote.volumeRatio ?? (indicators.volumeRatio20 ?? undefined);
  const computedTurnoverRate = quote.turnoverRate;

  return {
    ...stock,
    currentPrice: quote.price,
    changePercent: quote.changePercent,
    turnover: quote.amount / 100_000_000,
    volumeRatio: computedVolumeRatio ?? stock.volumeRatio,
    turnoverRate: computedTurnoverRate ?? stock.turnoverRate,
    signal: guard.signal,
    trendStage,
    sectorScore: dynamicSectorScore,
    riskLevel,
    shortTermScore: technicalWarning
      ? { ...shortTermScore, warnings: Array.from(new Set([...shortTermScore.warnings, technicalWarning])) }
      : shortTermScore,
    midTermScore,
    totalScore,
    tradeLevels,
    indicators,
    dataUpdatedAt: meta.marketTimestamp || quote.marketTimestamp || new Date().toISOString(),
    marketDataMeta: meta,
    technicalDataMeta: technicalMeta,
    dataCapabilityWarning: technicalWarning,
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
  const mockBars = mockMarketHistory[code];
  const mockStock = mockStocks.find((stock) => stock.code === code);
  if (!quoteResult.success && (!mockBars || !mockStock)) return null;

  const quote: StockQuote = quoteResult.success
    ? quoteResult.data
    : {
        code: mockStock!.code,
        name: mockStock!.name,
        exchange: "SZSE",
        price: mockStock!.currentPrice,
        previousClose: mockStock!.currentPrice / (1 + mockStock!.changePercent / 100),
        open: mockStock!.currentPrice,
        high: mockStock!.currentPrice,
        low: mockStock!.currentPrice,
        change: 0,
        changePercent: mockStock!.changePercent,
        volume: 0,
        amount: mockStock!.turnover * 100_000_000,
        turnoverRate: mockStock!.turnoverRate,
        volumeRatio: mockStock!.volumeRatio,
        bidPrice: mockStock!.currentPrice,
        askPrice: mockStock!.currentPrice,
        marketTimestamp: mockStock!.updatedAt,
        receivedAt: new Date().toISOString(),
        status: "unavailable",
        source: "tencent",
        isDemo: true,
      };

  const quoteMeta: MarketDataMeta = quoteResult.success
    ? quoteResult.meta
    : {
        source: "tencent",
        status: "unavailable",
        marketTimestamp: null,
        receivedAt: new Date().toISOString(),
        isDemo: true,
        mode: "live",
        upstreamErrorCode: quoteResult.error.code,
      };

  const bars = barsResult.success ? convertBars(barsResult.data) : mockBars ?? [];
  const technicalMeta: MarketDataMeta = barsResult.success
    ? barsResult.meta
    : {
        source: "演示历史快照",
        status: "unavailable",
        marketTimestamp: mockBars?.at(-1)?.date ?? null,
        receivedAt: new Date().toISOString(),
        isDemo: true,
        mode: quoteMeta.mode,
        upstreamErrorCode: barsResult.error.code,
      };

  const stock = quoteToStockAnalysis(quote, bars, quoteMeta, technicalMeta);
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
  const quotes = quotesResult.success
    ? quotesResult.data
    : mockStocks.map(
        (stock): StockQuote => ({
          code: stock.code,
          name: stock.name,
          exchange: "SZSE",
          price: stock.currentPrice,
          previousClose: stock.currentPrice / (1 + stock.changePercent / 100),
          open: stock.currentPrice,
          high: stock.currentPrice,
          low: stock.currentPrice,
          change: 0,
          changePercent: stock.changePercent,
          volume: 0,
          amount: stock.turnover * 100_000_000,
          turnoverRate: stock.turnoverRate,
          volumeRatio: stock.volumeRatio,
          bidPrice: stock.currentPrice,
          askPrice: stock.currentPrice,
          marketTimestamp: stock.updatedAt,
          receivedAt: new Date().toISOString(),
          status: "unavailable",
          source: "tencent",
          isDemo: true,
        }),
      );
  const quoteMeta: MarketDataMeta = quotesResult.success
    ? quotesResult.meta
    : {
        source: "tencent",
        status: "unavailable",
        marketTimestamp: null,
        receivedAt: new Date().toISOString(),
        isDemo: true,
        mode: "live",
        upstreamErrorCode: quotesResult.error.code,
      };

  const analyses = await Promise.all(
    quotes.map(async (quote) => {
      const barsResult = await service.getDailyBars(quote.code);
      const fallbackBars = mockMarketHistory[quote.code] ?? [];
      const technicalMeta: MarketDataMeta = barsResult.success
        ? barsResult.meta
        : {
            source: "演示历史快照",
            status: "unavailable",
            marketTimestamp: fallbackBars.at(-1)?.date ?? null,
            receivedAt: new Date().toISOString(),
            isDemo: true,
            mode: quoteMeta.mode,
            upstreamErrorCode: barsResult.error.code,
          };
      return quoteToStockAnalysis(quote, barsResult.success ? convertBars(barsResult.data) : fallbackBars, quoteMeta, technicalMeta);
    }),
  );

  return analyses.filter((stock): stock is MarketBackedStockAnalysis => stock !== null);
}
