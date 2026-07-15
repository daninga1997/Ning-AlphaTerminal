import type { StockAnalysis } from "@/types/stock";
import type { DataCapabilityMatrix } from "../../server/market-data/capability-matrix";
import { getCapabilityBadgeText, getSourceDisplayName } from "../../server/market-data/capability-matrix";
import type { StoredMarketOverviewSnapshot } from "@/server/market-storage/market-data-repository";
import { formatTurnover, getMarketDataMeta, getMarketOverview, getStoredMarketOverview } from "./dashboard-view-model";
import { MetricCard, SectionTitle } from "./dashboard-primitives";

export function MarketOverview({ capabilityMatrix, stocks, storedMarketOverview }: { capabilityMatrix?: DataCapabilityMatrix; stocks: StockAnalysis[]; storedMarketOverview?: StoredMarketOverviewSnapshot | null }) {
  const overview = getStoredMarketOverview(storedMarketOverview ?? null) ?? getMarketOverview(stocks);
  const meta = getMarketDataMeta(stocks);
  const quoteCapability = capabilityMatrix?.quotes;

  return (
    <section className="rounded-lg border border-white/10 bg-[#111722] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionTitle eyebrow="市场总览" title="市场总览" />
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="inline-flex w-fit rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-medium text-cyan-100">
            {meta?.isDemo ?? true ? "演示数据" : "真实数据"}
          </span>
          {capabilityMatrix ? (
            <span className="inline-flex w-fit rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 font-medium text-emerald-100">
              {getCapabilityBadgeText(capabilityMatrix)}
            </span>
          ) : null}
          {quoteCapability ? (
            <span>
              {getSourceDisplayName(quoteCapability.source)} · {quoteCapability.strategyUsed ?? "不可用"}
            </span>
          ) : null}
          {meta ? (
            <span>
              {meta.mode ?? "演示"} · {meta.source} · {meta.status} · 延迟 {meta.delayedSeconds ?? 0}s · 市场{" "}
              {meta.marketTimestamp} · 接收 {meta.receivedAt}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="市场情绪" tone="good" value={overview.sentiment} />
        <MetricCard label="建议仓位" tone="warn" value={overview.suggestedPosition} />
        <MetricCard label={`上涨家数${overview.status ? `（${overview.status}）` : ""}`} value={`${overview.risingCount} 只`} />
        <MetricCard label={`下跌家数${overview.status ? `（${overview.status}）` : ""}`} value={`${overview.fallingCount} 只`} />
        <MetricCard label={`成交额${overview.source ? "（真实/partial）" : "（模拟）"}`} value={formatTurnover(overview.turnover)} />
        <MetricCard label="数据更新时间" value={overview.updatedAt} />
      </div>
    </section>
  );
}
