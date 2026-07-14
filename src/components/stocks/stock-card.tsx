import { memo } from "react";
import Link from "next/link";
import type { StockAnalysis } from "@/types/stock";
import { getSignalPresentation } from "../../lib/presentation/signal-presentation";
import { ScoreBadge } from "./score-badge";
import { getSignalSummary } from "./watchlist-view-model";

export const StockCard = memo(function StockCard({ stock }: { stock: StockAnalysis }) {
  const signal = getSignalPresentation(stock.signal);

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

      <div className="mt-4 flex flex-1 flex-col justify-between gap-4">
        <p className="text-sm leading-6 text-[#DCE4F0]">{getSignalSummary(stock)}</p>
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
