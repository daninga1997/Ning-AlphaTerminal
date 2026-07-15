import { Dashboard, DashboardAssistant } from "@/components/dashboard/dashboard";
import { AppShell } from "@/components/layout/app-shell";
import { getDemoOpportunities, getTopStocks } from "@/lib/stock-ranking";
import { buildCapabilityMatrix } from "@/server/market-data/capability-matrix";
import { getMarketDataMode, getProvider } from "@/server/market-data/provider-registry";
import { analyzeAllStocksFromMarketData } from "@/server/market-data/stock-analysis-service";

export const revalidate = 15;

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
      <Dashboard capabilityMatrix={capabilityMatrix} stocks={stocks} />
    </AppShell>
  );
}
