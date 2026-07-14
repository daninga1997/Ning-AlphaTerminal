import { AppShell } from "@/components/layout/app-shell";
import { MemoryHeader } from "@/components/memory/memory-header";
import { MemoryPlanCard } from "@/components/memory/memory-plan-card";
import { MemorySection } from "@/components/memory/memory-section";
import { MemoryStatsSummary } from "@/components/memory/memory-stats-summary";
import { PrismaTradingPlanRepository } from "@/server/trading-memory/prisma-trading-plan-repository";
import { calculateTradingMemoryStats } from "@/server/trading-memory/trading-memory-stats";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const plans = await new PrismaTradingPlanRepository().listPlans();
  const stats = calculateTradingMemoryStats(plans);
  const today = plans.filter((plan) => plan.planDate === "2026-07-14");
  const active = plans.filter((plan) => ["active", "triggered"].includes(plan.status));
  const reviewPending = plans.filter(
    (plan) => ["completed", "cancelled", "invalidated", "expired"].includes(plan.status) && !plan.review,
  );

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4">
        <MemoryHeader total={plans.length} />
        <MemorySection title="今日计划">
          <PlanList plans={today} empty="今日暂无交易计划。" />
        </MemorySection>
        <MemorySection title="进行中计划">
          <PlanList plans={active} empty="暂无进行中计划。" />
        </MemorySection>
        <MemorySection title="待复盘计划">
          <PlanList plans={reviewPending} empty="暂无待复盘计划。" />
        </MemorySection>
        <MemorySection title="历史计划">
          <PlanList plans={plans} empty="暂无历史计划。" />
        </MemorySection>
        <MemoryStatsSummary stats={stats} />
      </div>
    </AppShell>
  );
}

function PlanList({ plans, empty }: { plans: Awaited<ReturnType<PrismaTradingPlanRepository["listPlans"]>>; empty: string }) {
  if (plans.length === 0) {
    return <p className="text-sm text-[#8B95A7]">{empty}</p>;
  }

  return (
    <div className="grid gap-3">
      {plans.map((plan) => (
        <MemoryPlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
