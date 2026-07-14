import Link from "next/link";
import type { TradingPlanRecord } from "@/server/trading-memory/trading-plan-repository";
import { planTypeLabels, statusLabels } from "./memory-utils";
import { MemorySection } from "./memory-section";
import { OriginalPlanSection } from "./original-plan-section";
import { ReviewSection } from "./review-section";
import { SnapshotSection } from "./snapshot-section";
import { TimelineSection } from "./timeline-section";

export function MemoryDetailView({ plan }: { plan: TradingPlanRecord }) {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4">
      <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
        <Link className="text-sm font-medium text-[#7AA7FF] hover:text-white" href="/memory">
          返回交易记忆
        </Link>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#F4F7FB]">
              {plan.name} <span className="font-mono text-base text-[#8B95A7]">{plan.code}</span>
            </h1>
            <p className="mt-2 text-sm text-[#8B95A7]">
              {plan.planDate} · {plan.sector} · {planTypeLabels[plan.planType]} · {statusLabels[plan.status]}
            </p>
          </div>
          <span className="w-fit rounded-full border border-[#4F8CFF]/25 bg-[#4F8CFF]/10 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">
            {plan.isDemo ? "演示交易记忆" : "真实交易记录"}
          </span>
        </div>
      </section>

      <OriginalPlanSection plan={plan} />
      <SnapshotSection plan={plan} />
      <TimelineSection plan={plan} />
      <ReviewSection plan={plan} />

      <MemorySection title="数据真实性说明">
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          {plan.isDemo
            ? "这是演示复盘，不代表真实交易收益。Mock/Replay/Live 统计默认隔离展示。"
            : "这是本地真实记录，仍需用户自行核对成交与行情来源。"}
        </div>
      </MemorySection>
    </div>
  );
}
