import Link from "next/link";
import type { TradingPlanRecord } from "@/server/trading-memory/trading-plan-repository";
import { getSignalPresentation } from "../../lib/presentation/signal-presentation";
import { formatPrice, planTypeLabels, statusLabels } from "./memory-utils";

export function MemoryPlanCard({ plan }: { plan: TradingPlanRecord }) {
  return (
    <Link
      className="block rounded-lg border border-[#252A33] bg-[#111318] p-4 transition hover:-translate-y-0.5 hover:border-[#3A4150] hover:bg-[#151922]"
      href={`/memory/${plan.id}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-[#F4F7FB]">{plan.name}</h3>
            <span className="font-mono text-sm text-[#8B95A7]">{plan.code}</span>
            <span className="rounded-full border border-[#252A33] px-2 py-0.5 text-xs text-[#DCE4F0]">
              {plan.sector}
            </span>
          </div>
          <p className="mt-2 text-sm text-[#8B95A7]">
            {plan.planDate} · {planTypeLabels[plan.planType]} · 原始信号{" "}
            {getSignalPresentation(plan.originalSignal).chineseLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#4F8CFF]/25 bg-[#4F8CFF]/10 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">
            {statusLabels[plan.status]}
          </span>
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
            {plan.isDemo ? "演示" : "真实"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="原始评分" value={plan.totalScore} />
        <Metric label="建仓区" value={`${formatPrice(plan.firstEntryLow)}-${formatPrice(plan.firstEntryHigh)}`} />
        <Metric label="止损位" value={formatPrice(plan.stopLoss)} />
        <Metric label="第一目标" value={formatPrice(plan.firstTarget)} />
        <Metric label="数据模式" value={plan.marketDataMode} />
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#252A33] bg-[#090A0D] p-3">
      <div className="text-xs text-[#8B95A7]">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold text-[#F4F7FB]">{value}</div>
    </div>
  );
}
