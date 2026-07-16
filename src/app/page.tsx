import { Dashboard, DashboardAssistant } from "@/components/dashboard/dashboard";
import { AppShell } from "@/components/layout/app-shell";
import { analyzeAllStocks } from "@/lib/stock-analysis";
import { getDemoOpportunities, getTopStocks } from "@/lib/stock-ranking";
import { buildCapabilityMatrix } from "@/server/market-data/capability-matrix";
import { getMarketDataMode, getProvider } from "@/server/market-data/provider-registry";
import { buildIntegrityReport } from "@/server/data-integrity/validators/integrity-report-builder";
import type { DataIntegrityReport } from "@/types/data-integrity";
import type { MarketDataResult, StockQuote } from "@/types/market-data";
import type { StockAnalysis } from "@/types/stock";
import { headers } from "next/headers";

export const revalidate = 60;

async function getHomeStocks(): Promise<StockAnalysis[]> {
  const stocks = analyzeAllStocks();
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  const codes = stocks.map((stock) => stock.code).join(",");

  try {
    const response = await fetch(`${origin}/api/market/quotes?codes=${codes}`, {
      cache: "no-store",
    });
    if (!response.ok) return stocks;

    const result = (await response.json()) as MarketDataResult<StockQuote[]>;
    if (!result.success) return stocks;

    const quotesByCode = new Map(result.data.map((quote) => [quote.code, quote]));
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
        dataUpdatedAt: quote.marketTimestamp || quote.receivedAt,
        marketDataMeta: {
          ...result.meta,
          source: quote.source,
          status: quote.status,
          marketTimestamp: quote.marketTimestamp || result.meta.marketTimestamp,
          receivedAt: quote.receivedAt,
          isDemo: quote.isDemo,
          strategyUsed: quote.strategyUsed ?? result.meta.strategyUsed,
        },
      };
    });
  } catch {
    return stocks;
  }
}

export default async function Home() {
  const stocks = await getHomeStocks();
  const mode = getMarketDataMode();
  const provider = getProvider(mode);
  const health = await provider.healthCheck();
  const firstStock = stocks[0];
  const capabilityMatrix = buildCapabilityMatrix({
    mode,
    providerName: health.source,
    health,
    quoteMeta: firstStock?.marketDataMeta ?? null,
    dailyMeta: firstStock?.technicalDataMeta ?? null,
  });
  const opportunities = getDemoOpportunities(stocks);
  const strongestSectorStock = getTopStocks(stocks, "totalScore", 1)[0];
  const strongestSector = strongestSectorStock
    ? {
        name: strongestSectorStock.sector,
        heat: strongestSectorStock.sectorScore,
        leaders: [strongestSectorStock.name],
      }
    : undefined;

  // 数据完整性报告
  let integrityReport: DataIntegrityReport | null = null;
  try {
    integrityReport = buildIntegrityReport({
      code: firstStock?.code ?? "000000",
      mode,
      quote: firstStock ? {
        code: firstStock.code,
        name: firstStock.name,
        exchange: "SZSE" as const,
        price: firstStock.currentPrice,
        previousClose: firstStock.currentPrice / (1 + firstStock.changePercent / 100),
        open: firstStock.currentPrice,
        high: firstStock.currentPrice,
        low: firstStock.currentPrice,
        change: 0,
        changePercent: firstStock.changePercent,
        volume: 0,
        amount: firstStock.turnover * 100_000_000,
        turnoverRate: firstStock.turnoverRate,
        volumeRatio: firstStock.volumeRatio,
        bidPrice: firstStock.currentPrice,
        askPrice: firstStock.currentPrice,
        marketTimestamp: firstStock.marketDataMeta?.marketTimestamp ?? firstStock.dataUpdatedAt,
        receivedAt: firstStock.marketDataMeta?.receivedAt ?? new Date().toISOString(),
    status: firstStock.marketDataMeta?.status ?? "delayed",
    source: firstStock.marketDataMeta?.source ?? "tencent",
    isDemo: firstStock.marketDataMeta?.isDemo ?? false,
        strategyUsed: firstStock.marketDataMeta?.strategyUsed ?? null,
      } : null,
      dailyBars: null,
      minuteBars: null,
      sectors: null,
      marketOverview: null,
    });
  } catch {
    integrityReport = null;
  }

  return (
    <AppShell
      rightRail={
        <DashboardAssistant
          aLevelStock={opportunities.aLevel[0]}
          hasBLevel={opportunities.bLevel.length > 0}
          strongestSector={strongestSector}
        />
      }
    >
      <Dashboard capabilityMatrix={capabilityMatrix} integrityReport={integrityReport} stocks={stocks} />
    </AppShell>
  );
}
