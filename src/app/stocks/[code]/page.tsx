import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StockDetailView } from "@/components/stocks/stock-detail-view";
import { mockStocks } from "@/data/mock-stocks";
import { getStockDetailFromMarketData } from "@/server/market-data/stock-analysis-service";
import { buildIntegrityReport } from "@/server/data-integrity/validators/integrity-report-builder";
import { getMarketDataMode } from "@/server/market-data/provider-registry";

export const revalidate = 60;

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

  const integrityReport = buildIntegrityReport({
    code,
    mode,
    quote: null,
    dailyBars: null,
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
