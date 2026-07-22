import type {
  DemoOpportunities,
  MockStock,
  StockAnalysis,
  StockFilters,
  StockSortField,
} from "@/types/stock";
import { signalLabels } from "./presentation/signal-presentation";

const shenzhenMainBoardPattern = /^(000|001|002)\d{3}$/;

export function isShenzhenMainBoardCode(code: string): boolean {
  return shenzhenMainBoardPattern.test(code);
}

function getSortableValue(stock: StockAnalysis, field: StockSortField): number {
  if (field === "shortTermScore") return stock.shortTermScore.total;
  if (field === "midTermScore") return stock.midTermScore.total;
  return stock[field];
}

export function sortStocks(stocks: StockAnalysis[], field: StockSortField): StockAnalysis[] {
  return [...stocks].sort((a, b) => getSortableValue(b, field) - getSortableValue(a, field));
}

export function filterStocks<T extends MockStock>(stocks: T[], filters: StockFilters): T[] {
  const normalizedQuery = filters.query.trim().toLowerCase();

  return stocks.filter((stock) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      stock.name.toLowerCase().includes(normalizedQuery) ||
      stock.code.includes(normalizedQuery);
    const matchesSector = filters.sector === "all" || stock.sector === filters.sector;
    const matchesSignal = filters.signal === "all" || stock.signal === filters.signal;

    return matchesQuery && matchesSector && matchesSignal;
  });
}

export function getOpportunities(stocks: StockAnalysis[]): DemoOpportunities {
  const sorted = sortStocks(stocks, "totalScore");
  const aLevel = sorted
    .filter(
      (stock) => stock.totalScore >= 90 && stock.signal === "buy" && stock.riskLevel !== "high",
    )
    .slice(0, 1);
  const aCodes = new Set(aLevel.map((stock) => stock.code));
  const bLevel = sorted
    .filter(
      (stock) =>
        !aCodes.has(stock.code) &&
        stock.totalScore >= 85 &&
        (stock.signal === "buy" || stock.signal === "wait") &&
        stock.riskLevel !== "high",
    )
    .slice(0, 2);

  return {
    aLevel,
    bLevel,
    hasOpportunities: aLevel.length > 0 || bLevel.length > 0,
  };
}

export const getDemoOpportunities = getOpportunities;

export function getUniqueSectors(stocks: MockStock[]): string[] {
  return Array.from(new Set(stocks.map((stock) => stock.sector)));
}

export function getTopStocks(
  stocks: StockAnalysis[],
  field: StockSortField,
  limit: number,
): StockAnalysis[] {
  return sortStocks(stocks, field).slice(0, limit);
}

export { signalLabels };

export const sortFieldLabels: Record<StockSortField, string> = {
  totalScore: "综合评分",
  shortTermScore: "短线评分",
  midTermScore: "中线评分",
  changePercent: "涨跌幅",
  turnover: "成交额",
};
