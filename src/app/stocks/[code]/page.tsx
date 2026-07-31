import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StockDetailView } from "@/components/stocks/stock-detail-view";
import { mockStocks } from "@/data/mock-stocks";
import { getStockDetailFromMarketData } from "@/server/market-data/stock-analysis-service";
import { buildIntegrityReport } from "@/server/data-integrity/validators/integrity-report-builder";
import { getMarketDataMode } from "@/server/market-data/provider-registry";
import { buildStrategyInputForCode } from "@/server/strategy-engine/strategy-input-builder";
import { runAllStrategies } from "@/server/strategy-engine/strategy-engine";
import type { DataIntegrityReport } from "@/types/data-integrity";

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

  let strategyOutput = null;
  let integrityReport: DataIntegrityReport | undefined;
  try {
    const strategyInput = await buildStrategyInputForCode(code);
    strategyOutput = runAllStrategies(strategyInput);
    integrityReport = strategyInput.integrityReport;
  } catch {
    // 策略引擎不可用时（例如数据库未初始化），个股页仍正常展示基础数据
    strategyOutput = null;
    integrityReport = buildIntegrityReport({
      code,
      mode,
      quote: null,
      dailyBars: null,
      minuteBars: null,
      sectors: null,
      marketOverview: null,
    });
  }

  return (
    <AppShell>
      <StockDetailView bars={detail.bars} integrityReport={integrityReport} stock={detail.stock} strategyOutput={strategyOutput} />
    </AppShell>
  );
}
