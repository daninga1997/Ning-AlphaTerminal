import Link from "next/link";
import type { MarketDataMeta } from "@/types/market-data";
import type { StockAnalysis } from "@/types/stock";
import { ScoreBadge } from "@/components/stocks/score-badge";
import { getSignalPresentation } from "../../../lib/presentation/signal-presentation";
import { getDecisionSummary } from "./decision-summary";

export function StockDecisionHeader({ stock }: { stock: StockAnalysis }) {
  const decision = getDecisionSummary(stock);
  const signal = getSignalPresentation(stock.signal);
  const meta = (stock as StockAnalysis & { marketDataMeta?: MarketDataMeta }).marketDataMeta;

  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Link className="text-sm font-medium text-[#7AA7FF] hover:text-white" href="/watchlist">
            返回观察池
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-[#F4F7FB]">{stock.name}</h1>
            <span className="rounded-md border border-[#252A33] bg-[#090A0D] px-3 py-1 font-mono text-sm text-[#DCE4F0]">
              {stock.code}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${signal.badgeClassName}`}>
              {signal.chineseLabel}
            </span>
            <span className="rounded-full border border-[#4F8CFF]/25 bg-[#4F8CFF]/10 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">
              {meta?.isDemo ?? true ? "演示数据" : "真实数据"}
            </span>
          </div>
          <p className="mt-2 text-sm text-[#8B95A7]">
            {stock.sector} · 数据更新时间 {stock.dataUpdatedAt}
          </p>
          {meta ? (
            <p className="mt-2 text-xs text-[#8B95A7]">
              模式 {meta.mode ?? "mock"} · 数据来源 {meta.source} · 状态 {meta.status} · 延迟{" "}
              {meta.delayedSeconds ?? 0}s · 市场时间 {meta.marketTimestamp} · 系统接收 {meta.receivedAt}
            </p>
          ) : null}
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#DCE4F0]">{decision.summary}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-2">
          <HeaderMetric label="当前模拟价格" value={stock.currentPrice.toFixed(2)} />
          <HeaderMetric label="当日模拟涨跌幅" value={`${stock.changePercent.toFixed(2)}%`} />
          <ScoreBadge label="综合" score={stock.totalScore} />
          <ScoreBadge label="短线" score={stock.shortTermScore.total} />
          <ScoreBadge label="中线" score={stock.midTermScore.total} />
          <HeaderMetric label="建议状态" value={decision.actionLabel} />
        </div>
      </div>
    </section>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#252A33] bg-[#090A0D] p-3">
      <div className="text-xs text-[#8B95A7]">{label}</div>
      <div className="mt-2 font-mono text-lg font-semibold text-[#F4F7FB]">{value}</div>
    </div>
  );
}
