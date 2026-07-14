"use client";

import type { Report } from "@/types/report";

export function ReportHistoryList({
  activeId,
  reports,
  onSelect,
}: {
  activeId: string;
  reports: Report[];
  onSelect: (report: Report) => void;
}) {
  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
        History
      </p>
      <h2 className="mt-1 text-base font-semibold text-[#F4F7FB]">历史报告列表</h2>
      <div className="mt-4 space-y-2">
        {reports.map((report) => (
          <button
            className={`w-full rounded-lg border p-3 text-left transition ${
              activeId === report.id
                ? "border-[#4F8CFF]/40 bg-[#1D2633]"
                : "border-[#252A33] bg-[#090A0D] hover:bg-[#171C24]"
            }`}
            key={report.id}
            onClick={() => onSelect(report)}
            type="button"
          >
            <div className="text-sm font-semibold text-[#F4F7FB]">{report.title}</div>
            <div className="mt-1 font-mono text-xs text-[#8B95A7]">{report.generatedAt}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
