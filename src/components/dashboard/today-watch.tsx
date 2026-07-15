import Link from "next/link";
import type { StockAnalysis } from "@/types/stock";
import { ScoreBadge } from "../stocks/score-badge";
import { getOpportunitySummary } from "./dashboard-view-model";
import { SectionTitle } from "./dashboard-primitives";

export function TodayWatch({ stocks }: { stocks: StockAnalysis[] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111722] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionTitle eyebrow="今日观察" title="B 级机会" />
        <span className="text-xs text-slate-500">最多 2 只</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {stocks.length > 0 ? (
          stocks.map((stock) => (
            <Link
              className="min-h-[138px] rounded-lg border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-300/30 hover:bg-white/[0.05]"
              href={`/stocks/${stock.code}`}
              key={stock.code}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">{stock.name}</h3>
                  <p className="mt-1 font-mono text-xs text-slate-500">{stock.code}</p>
                </div>
                <ScoreBadge label="综合" score={stock.totalScore} />
              </div>
              <div className="mt-3 text-xs text-cyan-100">{stock.sector}</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{getOpportunitySummary(stock)}</p>
            </Link>
          ))
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400 md:col-span-2">
            暂无 B 级机会。
          </div>
        )}
      </div>
    </section>
  );
}
