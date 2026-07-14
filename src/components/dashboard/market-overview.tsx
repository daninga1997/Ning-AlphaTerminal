import type { StockAnalysis } from "@/types/stock";
import { formatTurnover, getMarketDataMeta, getMarketOverview } from "./dashboard-view-model";
import { MetricCard, SectionTitle } from "./dashboard-primitives";

export function MarketOverview({ stocks }: { stocks: StockAnalysis[] }) {
  const overview = getMarketOverview(stocks);
  const meta = getMarketDataMeta(stocks);

  return (
    <section className="rounded-lg border border-white/10 bg-[#111722] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionTitle eyebrow="Market Overview" title="市场总览" />
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="inline-flex w-fit rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-medium text-cyan-100">
            {meta?.isDemo ?? true ? "演示数据" : "真实数据"}
          </span>
          {meta ? (
            <span>
              {meta.mode ?? "mock"} · {meta.source} · {meta.status} · 延迟 {meta.delayedSeconds ?? 0}s · 市场{" "}
              {meta.marketTimestamp} · 接收 {meta.receivedAt}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="市场情绪" tone="good" value={overview.sentiment} />
        <MetricCard label="建议仓位" tone="warn" value={overview.suggestedPosition} />
        <MetricCard label="上涨家数（模拟）" value={`${overview.risingCount} 只`} />
        <MetricCard label="下跌家数（模拟）" value={`${overview.fallingCount} 只`} />
        <MetricCard label="成交额（模拟）" value={formatTurnover(overview.turnover)} />
        <MetricCard label="数据更新时间" value={overview.updatedAt} />
      </div>
    </section>
  );
}
