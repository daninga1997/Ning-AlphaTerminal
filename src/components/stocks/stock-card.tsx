import { memo } from "react";
import Link from "next/link";
import type { StockAnalysis } from "@/types/stock";
import { getSignalPresentation } from "../../lib/presentation/signal-presentation";
import { getSourceDisplayName } from "../../server/market-data/capability-matrix";
import { ScoreBadge } from "./score-badge";
import { getSignalSummary } from "./watchlist-view-model";
import type { StrategyWatchlistItem } from "@/server/strategy-engine/strategy-watchlist-service";

export const StockCard = memo(function StockCard({ stock, strategyItem }: { stock: StockAnalysis; strategyItem?: StrategyWatchlistItem }) {
  const signal = getSignalPresentation(stock.signal);
  const meta = stock.marketDataMeta;
  const quoteUnavailable = meta?.status === "unavailable";
  const quoteStale = meta?.status === "stale";
  const plan = strategyItem?.finalPlan;

  return (
    <Link
      className="group flex min-h-[246px] flex-col rounded-lg border border-[#252A33] bg-[#111318] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.24)] transition duration-150 hover:-translate-y-0.5 hover:border-[#4F8CFF]/40 hover:bg-[#171C24] hover:shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
      href={`/stocks/${stock.code}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-[#F4F7FB]">{stock.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8B95A7]">
            <span className="font-mono">{stock.code}</span>
            <span className="h-1 w-1 rounded-full bg-[#394150]" />
            <span>{stock.sector}</span>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${signal.badgeClassName}`}>
          {signal.chineseLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <ScoreBadge label="综" score={stock.totalScore} />
        <ScoreBadge label="短" score={stock.shortTermScore.total} />
        <ScoreBadge label="中" score={stock.midTermScore.total} />
      </div>

      <div className="mt-4 rounded-lg border border-[#252A33] bg-[#090A0D] p-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#586174]">
              Quote
            </div>
            <div className="mt-1 font-mono text-xl font-semibold text-[#F4F7FB]">
              {quoteUnavailable ? "报价不可用" : stock.currentPrice.toFixed(2)}
            </div>
          </div>
          <div className={`font-mono text-sm font-semibold ${stock.changePercent >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {quoteUnavailable ? "--" : `${stock.changePercent.toFixed(2)}%`}
          </div>
        </div>
        <div className="mt-2 text-xs leading-5 text-[#8B95A7]">
          {quoteStale ? "stale · " : ""}
          {getSourceDisplayName(meta?.source)} · {meta?.strategyUsed ?? "unavailable"}
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col justify-between gap-4">
        <p className="text-sm leading-6 text-[#DCE4F0]">{getSignalSummary(stock)}</p>
        {plan ? (
          <div className="rounded-lg border border-[#252A33] bg-[#090A0D] p-3 text-xs leading-5 text-[#8B95A7]">
            <div className="font-semibold text-[#DCE4F0]">
              策略 {plan.primaryStrategy ?? "无主策略"} · {plan.currentAction}
            </div>
            <div>关注区 {plan.watchZone.low.toFixed(2)}-{plan.watchZone.high.toFixed(2)} · 追高上限 {plan.chaseLimit.price.toFixed(2)}</div>
            <div>完整度 {strategyItem.integrity.completenessPercent}% · {strategyItem.integrity.permission}</div>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 border-t border-[#1A1F27] pt-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#586174]">
              Updated
            </div>
            <div className="mt-1 font-mono text-xs text-[#8B95A7]">{stock.dataUpdatedAt}</div>
          </div>
          <span className="rounded-md border border-[#252A33] bg-[#090A0D] px-3 py-2 text-xs font-semibold text-[#F4F7FB] transition group-hover:border-[#4F8CFF]/40">
            查看详情
          </span>
        </div>
      </div>
    </Link>
  );
});
