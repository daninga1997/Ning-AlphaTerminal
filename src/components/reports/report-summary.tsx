import type { Report } from "@/types/report";
import { getOpportunityMessage } from "@/lib/reports/report-utils";

export function ReportSummary({ report }: { report: Report }) {
  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
        Current Report
      </p>
      <h2 className="mt-2 text-xl font-semibold text-[#F4F7FB]">{report.title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#DCE4F0]">{report.marketSummary}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="市场情绪评分" value={String(report.marketScore)} />
        <SummaryMetric label="建议仓位" value={report.suggestedPosition} />
        <SummaryMetric label="机会状态" value={getOpportunityMessage(report)} />
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#252A33] bg-[#090A0D] p-3">
      <div className="text-xs text-[#8B95A7]">{label}</div>
      <div className="mt-2 font-mono text-lg font-semibold text-[#F4F7FB]">{value}</div>
    </div>
  );
}
