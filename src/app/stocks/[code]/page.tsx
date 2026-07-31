import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StockDetailView } from "@/components/stocks/stock-detail-view";
import { mockStocks } from "@/data/mock-stocks";
import { getStockDetailFromMarketData } from "@/server/market-data/stock-analysis-service";
import { buildStrategyInputForCode } from "@/server/strategy-engine/strategy-input-builder";
import { runAllStrategies } from "@/server/strategy-engine/strategy-engine";

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

  const strategyInput = await buildStrategyInputForCode(code);
  const strategyOutput = runAllStrategies(strategyInput);

  return (
    <AppShell>
      <StockDetailView
        bars={detail.bars}
        integrityReport={strategyInput.integrityReport}
        stock={detail.stock}
        strategyOutput={strategyOutput}
      />
    </AppShell>
  );
}
