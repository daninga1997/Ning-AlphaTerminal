import { Dashboard, DashboardAssistant } from "@/components/dashboard/dashboard";
import { AppShell } from "@/components/layout/app-shell";
import { getDemoOpportunities, getTopStocks } from "@/lib/stock-ranking";
import { analyzeAllStocksFromMarketData } from "@/server/market-data/stock-analysis-service";

export default async function Home() {
  const stocks = await analyzeAllStocksFromMarketData();
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
      <Dashboard stocks={stocks} />
    </AppShell>
  );
}
