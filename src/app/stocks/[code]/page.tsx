import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StockDetailView } from "@/components/stocks/stock-detail-view";
import { mockStocks } from "@/data/mock-stocks";
import { getStockDetailFromMarketData } from "@/server/market-data/stock-analysis-service";

export function generateStaticParams() {
  return mockStocks.map((stock) => ({ code: stock.code }));
}

export default async function StockDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const detail = await getStockDetailFromMarketData(code);

  if (!detail) {
    notFound();
  }

  return (
    <AppShell>
      <StockDetailView bars={detail.bars} stock={detail.stock} />
    </AppShell>
  );
}
