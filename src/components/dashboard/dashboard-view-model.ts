import type { MarketDataMeta } from "@/types/market-data";
import type { StockAnalysis } from "@/types/stock";
import { getOpportunities, getTopStocks } from "../../lib/stock-ranking";

export type SectorPulse = {
  name: string;
  heat: number;
  leaders: string[];
  source?: string;
  status?: string;
};

export type MarketOverviewModel = {
  sentiment: string;
  suggestedPosition: string;
  risingCount: number;
  fallingCount: number;
  turnover: number;
  updatedAt: string;
  source?: string;
  status?: string;
};

const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export function formatPrice(value: number): string {
  return value.toFixed(2);
}

export function formatTurnover(value: number): string {
  return `${currencyFormatter.format(value)} 亿`;
}

export function getLatestUpdate(stocks: StockAnalysis[]): string {
  return stocks[0]?.dataUpdatedAt ?? "暂无数据";
}

export function getMarketDataMeta(stocks: StockAnalysis[]): MarketDataMeta | null {
  const stock = stocks[0] as (StockAnalysis & { marketDataMeta?: MarketDataMeta }) | undefined;
  return stock?.marketDataMeta ?? null;
}

export function getMarketOverview(stocks: StockAnalysis[]): MarketOverviewModel {
  const risingCount = stocks.filter((stock) => stock.changePercent > 0).length;
  const fallingCount = stocks.filter((stock) => stock.changePercent < 0).length;
  const turnover = stocks.reduce((sum, stock) => sum + stock.turnover, 0);
  const opportunities = getOpportunities(stocks);

  const sentiment =
    opportunities.aLevel.length > 0 && risingCount > fallingCount
      ? "偏积极"
      : risingCount >= fallingCount
        ? "结构性活跃"
        : "谨慎";
  const suggestedPosition =
    opportunities.aLevel.length > 0 ? "40%-50%" : opportunities.bLevel.length > 0 ? "20%-30%" : "0%-20%";

  return {
    sentiment,
    suggestedPosition,
    risingCount,
    fallingCount,
    turnover,
    updatedAt: getLatestUpdate(stocks),
  };
}

export function getStoredMarketOverview(input: {
  marketScore: number;
  advancingCount: number;
  decliningCount: number;
  totalAmount: number;
  fetchedAt: Date;
  source: string;
  dataStatus: string;
} | null): MarketOverviewModel | null {
  if (!input) return null;
  return {
    sentiment: input.marketScore >= 70 ? "偏积极" : input.marketScore >= 55 ? "结构性活跃" : "谨慎",
    suggestedPosition: input.dataStatus === "partial" ? "0%-20%" : input.marketScore >= 70 ? "40%-60%" : input.marketScore >= 55 ? "20%-40%" : "0%-20%",
    risingCount: input.advancingCount,
    fallingCount: input.decliningCount,
    turnover: input.totalAmount / 100_000_000,
    updatedAt: input.fetchedAt.toISOString(),
    source: input.source,
    status: input.dataStatus,
  };
}

export function getStoredHotSectors(
  sectors: Array<{ sectorName: string; strengthScore: number; leadingStocksJson: string; source: string; dataStatus: string }> | null,
): SectorPulse[] | null {
  if (!sectors || sectors.length === 0) return null;
  return sectors
    .map((sector) => ({
      name: sector.sectorName,
      heat: Math.round(sector.strengthScore),
      leaders: JSON.parse(sector.leadingStocksJson) as string[],
      source: sector.source,
      status: sector.dataStatus,
    }))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 3);
}

export function getHotSectors(stocks: StockAnalysis[]): SectorPulse[] {
  const sectorMap = new Map<string, StockAnalysis[]>();

  for (const stock of stocks) {
    const sectorStocks = sectorMap.get(stock.sector) ?? [];
    sectorStocks.push(stock);
    sectorMap.set(stock.sector, sectorStocks);
  }

  return Array.from(sectorMap.entries())
    .map(([name, sectorStocks]) => {
      const averageScore = Math.round(
        sectorStocks.reduce((sum, stock) => sum + stock.sectorScore, 0) / sectorStocks.length,
      );
      const leaders = getTopStocks(sectorStocks, "totalScore", 2).map((stock) => stock.name);

      return {
        name,
        heat: averageScore,
        leaders,
      };
    })
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 3);
}

export function getOpportunitySummary(stock: StockAnalysis): string {
  if (stock.signal === "buy") {
    return `${stock.sector}强度靠前，综合评分 ${stock.totalScore}，等待计划内价格执行。`;
  }

  if (stock.signal === "wait") {
    return `${stock.sector}仍在观察区，需等待回踩或量能确认。`;
  }

  return `${stock.sector}有关注价值，但当前信号不是开仓优先级。`;
}
