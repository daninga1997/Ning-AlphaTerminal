import type { Report } from "@/types/report";
import { DataStatusBadge } from "./data-status-badge";

export function ReportsHeader({ report, totalCount }: { report: Report; totalCount: number }) {
  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-[#F4F7FB] sm:text-3xl">Reports</h1>
            <span className="rounded-full border border-[#4F8CFF]/25 bg-[#4F8CFF]/10 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">
              演示报告
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8B95A7]">
            统一查看盘前、盘中、盘后报告。当前展示 {report.title}，共 {totalCount} 份固定模拟报告。
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#8B95A7]">
            <span>报告日期 {report.reportDate}</span>
            <span>生成时间 {report.generatedAt}</span>
          </div>
        </div>
        <DataStatusBadge status={report.dataStatus} />
      </div>
    </section>
  );
}
