import { Dashboard, DashboardAssistant } from "@/components/dashboard/dashboard";
import { AppShell } from "@/components/layout/app-shell";
import { getDemoOpportunities, getTopStocks } from "@/lib/stock-ranking";
import { buildCapabilityMatrix } from "@/server/market-data/capability-matrix";
import { getMarketDataMode, getProvider } from "@/server/market-data/provider-registry";
import { analyzeAllStocksFromMarketData } from "@/server/market-data/stock-analysis-service";
import { buildIntegrityReport } from "@/server/data-integrity/validators/integrity-report-builder";
import type { DataIntegrityReport } from "@/types/data-integrity";

export const revalidate = 60;

export default async function Home() {
  const stocks = await analyzeAllStocksFromMarketData();
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
        status: firstStock.marketDataMeta?.status ?? "unavailable",
        source: firstStock.marketDataMeta?.source ?? "mock",
        isDemo: firstStock.marketDataMeta?.isDemo ?? true,
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
