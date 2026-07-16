import { AppShell } from "@/components/layout/app-shell";
import { WatchlistView } from "@/components/stocks/watchlist-view";
import { analyzeAllStocksFromMarketData } from "@/server/market-data/stock-analysis-service";
import { IntegrityStatusBar } from "@/components/data-integrity/integrity-status-bar";
import { buildIntegrityReport } from "@/server/data-integrity/validators/integrity-report-builder";
import { getMarketDataMode } from "@/server/market-data/provider-registry";

export default async function WatchlistPage() {
  const stocks = await analyzeAllStocksFromMarketData();
  const mode = getMarketDataMode();
  const firstStock = stocks[0];

  const quote = firstStock ? {
    code: firstStock.code,
    name: firstStock.name,
    exchange: "SZSE" as const,
    price: firstStock.currentPrice,
    previousClose: firstStock.currentPrice / (1 + (firstStock.changePercent ?? 0) / 100),
    open: firstStock.currentPrice,
    high: firstStock.currentPrice,
    low: firstStock.currentPrice,
    change: 0,
    changePercent: firstStock.changePercent ?? 0,
    volume: 0,
    amount: (firstStock.turnover ?? 0) * 100_000_000,
    turnoverRate: firstStock.turnoverRate ?? 0,
    volumeRatio: firstStock.volumeRatio ?? 0,
    bidPrice: firstStock.currentPrice,
    askPrice: firstStock.currentPrice,
    marketTimestamp: firstStock.marketDataMeta?.marketTimestamp ?? firstStock.dataUpdatedAt ?? new Date().toISOString(),
    receivedAt: firstStock.marketDataMeta?.receivedAt ?? new Date().toISOString(),
status: firstStock.marketDataMeta?.status ?? "delayed",
source: firstStock.marketDataMeta?.source ?? "tencent",
isDemo: false,
    strategyUsed: firstStock.marketDataMeta?.strategyUsed ?? null,
  } : null;

  const integrityReport = buildIntegrityReport({
    code: firstStock?.code ?? "000000",
    mode,
    quote,
    dailyBars: null,
    minuteBars: null,
    sectors: null,
    marketOverview: null,
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <IntegrityStatusBar
          latestTradingDate={integrityReport.latestTradingDate}
          completenessPercent={integrityReport.completenessPercent}
          status={integrityReport.status}
          permission={integrityReport.permission}
          canGenerateTradePlan={integrityReport.canGenerateTradePlan}
          quoteTimestamp={integrityReport.marketTimestamp}
          quoteSource={integrityReport.quoteSource}
        />
        <WatchlistView stocks={stocks} />
      </div>
    </AppShell>
  );
}
