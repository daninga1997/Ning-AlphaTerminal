import type { Report } from "@/types/report";

export function MarketOverviewSection({ report }: { report: Report }) {
  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
        Market Overview
      </p>
      <h2 className="mt-1 text-lg font-semibold text-[#F4F7FB]">市场概览</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[#252A33] bg-[#090A0D] p-3">
          <div className="text-xs text-[#8B95A7]">市场状态</div>
          <div className="mt-2 text-base font-semibold text-[#F4F7FB]">{report.marketStatus}</div>
        </div>
        <div className="rounded-lg border border-[#252A33] bg-[#090A0D] p-3">
          <div className="text-xs text-[#8B95A7]">市场评分</div>
          <div className="mt-2 font-mono text-base font-semibold text-[#F4F7FB]">
            {report.marketScore}
          </div>
        </div>
        <div className="rounded-lg border border-[#252A33] bg-[#090A0D] p-3">
          <div className="text-xs text-[#8B95A7]">建议总仓位</div>
          <div className="mt-2 font-mono text-base font-semibold text-[#F4F7FB]">
            {report.suggestedPosition}
          </div>
        </div>
      </div>
    </section>
  );
}
