import type { ReportDataStatus } from "@/types/report";
import { getDataStatusWarning } from "@/lib/reports/report-utils";

const statusConfig: Record<ReportDataStatus, { label: string; className: string }> = {
  fresh: {
    label: "数据新鲜",
    className: "border-emerald-400/30 bg-emerald-400/12 text-emerald-100",
  },
  delayed: {
    label: "数据延迟",
    className: "border-amber-400/30 bg-amber-400/12 text-amber-100",
  },
  stale: {
    label: "数据过期",
    className: "border-orange-400/30 bg-orange-400/12 text-orange-100",
  },
  unavailable: {
    label: "数据不可用",
    className: "border-red-400/30 bg-red-400/12 text-red-100",
  },
};

export function DataStatusBadge({ status }: { status: ReportDataStatus }) {
  const config = statusConfig[status];
  const warning = getDataStatusWarning(status);

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
      {warning ? <p className="max-w-sm text-xs leading-5 text-amber-100">{warning}</p> : null}
    </div>
  );
}
