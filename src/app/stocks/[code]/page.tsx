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

  // 路由前置拦截：非深市主板代码
  if (!/^(000|001|002)\d{3}$/.test(code)) {
    return (
      <AppShell>
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-8">
          <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-6">
            <h1 className="text-xl font-semibold text-amber-200">该股票不在策略支持范围内</h1>
            <p className="mt-3 text-sm leading-6 text-amber-100">
              判官之眼当前仅支持深市主板股票（000/001/002 开头）。创业板（300）、沪市主板（600）、科创板（688）等暂不支持策略分析，仅可查看基础行情。
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!watchlistCodes.includes(code)) {
    const researchDetail = await getResearchStockDetail(code);
    if (!researchDetail) notFound();

    // 自动加入触发（在外部股票详情页加载时异步写入）
    const { strategyAction, dataBlockers, quote, isCoreWatchlist } = researchDetail;
    const autoJoinActions = new Set(["buy_allowed", "wait_for_pullback", "breakout_watch", "focus"]);
    if (!isCoreWatchlist && autoJoinActions.has(strategyAction) && dataBlockers.length === 0) {
      const origin = process.env.NEXT_PUBLIC_ORIGIN ?? "http://localhost:80";
      fetch(`${origin}/api/watchlist/dynamic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name: quote.name,
          action: strategyAction,
          blockers: dataBlockers,
          conclusion: `策略动作: ${strategyAction}`,
          analysisDate: new Date().toISOString(),
          hvPercentile: null,
        }),
      }).catch(() => {});
    }

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

  // 使用真实数据构建完整性报告
  const integrityReport = buildIntegrityReport({
    code,
    mode,
    quote: detail.stock ? {
      code: detail.stock.code,
      name: detail.stock.name ?? "",
      exchange: "SZSE" as const,
      price: detail.stock.currentPrice,
      previousClose: detail.stock.currentPrice / (1 + (detail.stock.changePercent ?? 0) / 100),
      open: detail.stock.currentPrice,
      high: detail.stock.currentPrice,
      low: detail.stock.currentPrice,
      change: 0,
      changePercent: detail.stock.changePercent ?? 0,
      volume: 0,
      amount: (detail.stock.turnover ?? 0) * 100_000_000,
      turnoverRate: detail.stock.turnoverRate ?? 0,
      volumeRatio: detail.stock.volumeRatio ?? 0,
      bidPrice: detail.stock.currentPrice,
      askPrice: detail.stock.currentPrice,
      marketTimestamp: detail.stock.marketDataMeta?.marketTimestamp ?? detail.stock.dataUpdatedAt,
      receivedAt: detail.stock.marketDataMeta?.receivedAt ?? new Date().toISOString(),
      status: detail.stock.marketDataMeta?.status ?? "delayed",
      source: detail.stock.marketDataMeta?.source ?? "tencent",
      isDemo: detail.stock.marketDataMeta?.isDemo ?? false,
      strategyUsed: detail.stock.marketDataMeta?.strategyUsed ?? null,
    } : null,
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
