import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StockDetailView } from "@/components/stocks/stock-detail-view";
import { mockStocks } from "@/data/mock-stocks";
import { getStockDetailFromMarketData } from "@/server/market-data/stock-analysis-service";
import { buildIntegrityReport } from "@/server/data-integrity/validators/integrity-report-builder";
import { getMarketDataMode } from "@/server/market-data/provider-registry";
import type { StockQuote } from "@/types/market-data";

export function generateStaticParams() {
  return mockStocks.map((stock) => ({ code: stock.code }));
}

export default async function StockDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const detail = await getStockDetailFromMarketData(code);

  if (!detail) {
    notFound();
  }

  const mode = getMarketDataMode();
  const stock = detail.stock;
  const quote: StockQuote | null = stock ? {
    code: stock.code,
    name: stock.name,
    exchange: "SZSE" as const,
    price: stock.currentPrice,
    previousClose: stock.currentPrice / (1 + (stock.changePercent ?? 0) / 100),
    open: stock.currentPrice,
    high: stock.currentPrice,
    low: stock.currentPrice,
    change: 0,
    changePercent: stock.changePercent ?? 0,
    volume: 0,
    amount: (stock.turnover ?? 0) * 100_000_000,
    turnoverRate: stock.turnoverRate ?? 0,
    volumeRatio: stock.volumeRatio ?? 0,
    bidPrice: stock.currentPrice,
    askPrice: stock.currentPrice,
    marketTimestamp: stock.marketDataMeta?.marketTimestamp ?? stock.dataUpdatedAt ?? new Date().toISOString(),
    receivedAt: stock.marketDataMeta?.receivedAt ?? new Date().toISOString(),
    status: stock.marketDataMeta?.status ?? "unavailable",
    source: stock.marketDataMeta?.source ?? "mock",
    isDemo: stock.marketDataMeta?.isDemo ?? true,
    strategyUsed: stock.marketDataMeta?.strategyUsed ?? null,
  } : null;

  const integrityReport = buildIntegrityReport({
    code,
    mode,
    quote,
    dailyBars: detail.bars.length > 0
      ? detail.bars.map((b) => ({
          code,
          date: b.date,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          previousClose: b.open,
          volume: b.volume,
          amount: b.turnover * 100_000_000,
          turnoverRate: 0,
          source: stock?.marketDataMeta?.source ?? "mock",
          isDemo: stock?.marketDataMeta?.isDemo ?? true,
        }))
      : null,
    minuteBars: null,
    sectors: null,
    marketOverview: null,
  });

  return (
    <AppShell>
      <StockDetailView bars={detail.bars} integrityReport={integrityReport} stock={detail.stock} />
    </AppShell>
  );
}
