import { AppShell } from "@/components/layout/app-shell";
import { WatchlistView } from "@/components/stocks/watchlist-view";
import { analyzeAllStocksFromMarketData } from "@/server/market-data/stock-analysis-service";

export default async function WatchlistPage() {
  return (
    <AppShell>
      <WatchlistView stocks={await analyzeAllStocksFromMarketData()} />
    </AppShell>
  );
}
