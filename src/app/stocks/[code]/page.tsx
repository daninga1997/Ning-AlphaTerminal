import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StockDetailView } from "@/components/stocks/stock-detail-view";
import { mockStocks } from "@/data/mock-stocks";
import { getStockDetailFromMarketData } from "@/server/market-data/stock-analysis-service";
import { getResearchStockDetail } from "@/server/market-data/research-stock-service";
import { buildIntegrityReport } from "@/server/data-integrity/validators/integrity-report-builder";
import { getMarketDataMode, getProvider } from "@/server/market-data/provider-registry";
import { watchlistCodes } from "@/server/market-sync/sector-mapping";
import { ResearchStockDetailView } from "@/components/stocks/research-stock-detail-view";

export const revalidate = 60;
export const dynamicParams = true;

export function generateStaticParams() {
  return mockStocks.map((stock) => ({ code: stock.code }));
}

export default async function StockDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!watchlistCodes.includes(code)) {
    const researchDetail = await getResearchStockDetail(code);
    if (!researchDetail) notFound();

    return (
      <AppShell>
        <ResearchStockDetailView detail={researchDetail} />
      </AppShell>
    );
  }

  const detail = await getStockDetailFromMarketData(code);

  if (!detail) {
    notFound();
  }

  const mode = getMarketDataMode();
  const provider = getProvider(mode);

  // 通过正规Provider获取日线
  let realBars: typeof detail.bars = detail.bars;
  try {
    const dailyBars = await provider.getDailyBars(code);
    if (dailyBars.length > 0) {
      realBars = dailyBars.map((b) => ({
        date: b.date,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
        turnover: b.amount,
      }));
    }
  } catch {
    // 保持fallback日线
  }

  // 使用真实日线构建完整性报告
  const integrityReport = buildIntegrityReport({
    code,
    mode,
    quote: null,
    dailyBars: realBars.length > 0
      ? realBars.map((b) => ({
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
          source: detail.stock.marketDataMeta?.source ?? "tencent",
          isDemo: detail.stock.marketDataMeta?.isDemo ?? false,
        }))
      : null,
    minuteBars: null,
    sectors: null,
    marketOverview: null,
  });

  return (
    <AppShell>
      <StockDetailView bars={realBars} integrityReport={integrityReport} stock={detail.stock} />
    </AppShell>
  );
}
