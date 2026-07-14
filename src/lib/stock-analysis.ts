import { mockMarketHistory } from "../data/mock-market-history";
import { mockStocks } from "../data/mock-stocks";
import type { StockAnalysis } from "../types/stock";
import { calculateIndicators } from "./indicators";
import { calculateMidTermScore } from "./scoring/mid-term-score";
import { calculateShortTermScore } from "./scoring/short-term-score";
import { calculateTradeLevels } from "./trading/trade-levels";

export function analyzeStock(code: string): StockAnalysis | null {
  const stock = mockStocks.find((item) => item.code === code);
  const bars = mockMarketHistory[code];
  if (!stock || !bars) return null;

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

  return {
    ...stock,
    shortTermScore,
    midTermScore,
    totalScore,
    tradeLevels,
    indicators,
    dataUpdatedAt: bars.at(-1)?.date ?? stock.updatedAt,
  };
}

export function analyzeAllStocks(): StockAnalysis[] {
  return mockStocks
    .map((stock) => analyzeStock(stock.code))
    .filter((stock): stock is StockAnalysis => stock !== null);
}
