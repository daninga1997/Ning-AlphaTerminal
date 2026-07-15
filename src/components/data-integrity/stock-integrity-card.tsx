import type { DataIntegrityReport } from "@/types/data-integrity";

export function StockIntegrityCard({ report, compact }: { report: DataIntegrityReport; compact?: boolean }) {
  const isFull = report.permission === "full";
  const isBlocked = report.permission === "blocked";
  const isWatchOnly = report.permission === "watch_only";

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-xs">
        <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 font-medium ${
          isFull ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" :
          isBlocked ? "border-red-400/30 bg-red-400/10 text-red-200" :
          "border-amber-400/30 bg-amber-400/10 text-amber-200"
        }`}>
          {statusLabel(report)}
        </span>
        <span className="font-mono text-slate-400">{report.completenessPercent}%</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#111722] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="mt-1 text-sm font-semibold text-white">数据事实</h3>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${
          isFull ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" :
          isWatchOnly ? "border-amber-400/25 bg-amber-400/10 text-amber-200" :
          isBlocked ? "border-red-400/25 bg-red-400/10 text-red-200" :
          "border-slate-400/25 bg-slate-400/10 text-slate-300"
        }`}>
          {permissionLabel(report)}
        </span>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">股票代码</span>
          <span className="font-mono text-white">{report.code}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">分析交易日</span>
          <span className="font-mono text-white">{report.latestTradingDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">完整度</span>
          <span className={`font-mono font-semibold ${report.completenessPercent >= 85 ? "text-emerald-300" : "text-amber-300"}`}>
            {report.completenessPercent}%
          </span>
        </div>
        {report.quoteTradingDate && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Quote时间</span>
            <span className="font-mono text-slate-300">{formatTime(report.quoteTradingDate)}</span>
          </div>
        )}
        {report.dailyBarsLatestDate && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">日线最新</span>
            <span className="font-mono text-slate-300">{report.dailyBarsLatestDate}</span>
          </div>
        )}
        {report.minuteBarsLatestDate && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">分钟线最新</span>
            <span className="font-mono text-slate-300">{formatTime(report.minuteBarsLatestDate)}</span>
          </div>
        )}
        {report.quoteSource && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">来源</span>
            <span className="text-slate-400">{report.quoteSource}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-slate-500">权限</span>
          <span className={isFull ? "text-emerald-300" : isBlocked ? "text-red-300" : "text-amber-300"}>
            {permissionLabel(report)}
          </span>
        </div>
      </div>

      {report.issues.length > 0 && (
        <div className="mt-3 rounded-md border border-red-400/20 bg-red-400/8 px-3 py-2 text-xs text-red-200">
          {report.issues.map((issue, i) => (
            <div key={i}>• {issue.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  if (iso.includes("T")) return iso.slice(11, 19);
  return iso;
}

function statusLabel(report: DataIntegrityReport): string {
  switch (report.status) {
    case "complete": return "完整";
    case "partial": return "部分";
    case "stale": return "过期";
    case "conflicting": return "冲突";
    case "unavailable": return "不可用";
    case "demo_only": return "演示";
  }
}

function permissionLabel(report: DataIntegrityReport): string {
  switch (report.permission) {
    case "full": return "完整交易";
    case "watch_only": return "仅观察";
    case "historical_only": return "历史分析";
    case "blocked": return "已阻断";
  }
}