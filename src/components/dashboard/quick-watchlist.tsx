import Link from "next/link";
import type { StockAnalysis } from "@/types/stock";
import { StockSignalBadge } from "../stocks/stock-signal-badge";
import { SectionTitle } from "./dashboard-primitives";

export function QuickWatchlist({ stocks }: { stocks: StockAnalysis[] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111722] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionTitle eyebrow="观察池" title="观察池 Top10" />
        <Link className="text-xs font-medium text-cyan-100 hover:text-white" href="/watchlist">
          全部观察池
        </Link>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {stocks.map((stock, index) => (
          <Link
            className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:border-cyan-300/30 hover:bg-white/[0.05]"
            href={`/stocks/${stock.code}`}
            key={stock.code}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-5 text-xs text-slate-500">#{index + 1}</span>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">{stock.name}</div>
                <div className="font-mono text-xs text-slate-500">{stock.code}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StockSignalBadge signal={stock.signal} />
              <span className="min-w-8 text-right font-mono text-sm font-semibold text-white">
                {stock.totalScore}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
