import type { DataIntegrityStatus, TradeDecisionPermission } from "@/types/data-integrity";

export function IntegrityStatusBar({
  latestTradingDate,
  completenessPercent,
  status,
  permission,
  canGenerateTradePlan,
  quoteTimestamp,
  quoteSource,
}: {
  latestTradingDate: string;
  completenessPercent: number;
  status: DataIntegrityStatus;
  permission: TradeDecisionPermission;
  canGenerateTradePlan: boolean;
  quoteTimestamp?: string | null;
  quoteSource?: string | null;
}) {
  const statusLabel = statusLabelMap[status] ?? status;
  const permissionLabel = permissionLabelMap[permission] ?? permission;
  const isOk = status === "complete" || status === "partial";
  const isBlocked = status === "unavailable" || status === "demo_only" || permission === "blocked";

  return (
    <div className="rounded-lg border border-white/10 bg-[#111722] p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">交易日：</span>
          <span className="font-mono text-white">{latestTradingDate}</span>
        </div>
        {quoteTimestamp && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">行情截止：</span>
            <span className="font-mono text-white">{formatTime(quoteTimestamp)}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-slate-500">完整度：</span>
          <span className={`font-mono font-semibold ${completenessPercent >= 85 ? "text-emerald-300" : completenessPercent >= 60 ? "text-amber-300" : "text-red-300"}`}>
            {completenessPercent}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">状态：</span>
          <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 font-medium ${isOk ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : isBlocked ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">权限：</span>
          <span className={`font-semibold ${permission === "full" ? "text-emerald-300" : permission === "watch_only" ? "text-amber-300" : permission === "blocked" ? "text-red-300" : "text-slate-400"}`}>
            {permissionLabel}
          </span>
        </div>
        {!canGenerateTradePlan && (
          <div className="flex items-center gap-2">
            <span className="text-red-400">⚠ 暂不生成完整交易计划</span>
          </div>
        )}
        {quoteSource && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">来源：</span>
            <span className="text-slate-400">{quoteSource}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  return iso.slice(11, 19);
}

const statusLabelMap: Record<DataIntegrityStatus, string> = {
  complete: "完整",
  partial: "部分可用",
  stale: "数据过期",
  conflicting: "来源冲突",
  unavailable: "不可用",
  demo_only: "演示数据",
};

const permissionLabelMap: Record<TradeDecisionPermission, string> = {
  full: "完整",
  watch_only: "仅观察",
  historical_only: "历史分析",
  blocked: "已阻断",
};