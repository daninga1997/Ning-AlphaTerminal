import type { TradingPlanRecord } from "@/server/trading-memory/trading-plan-repository";
import { outcomeLabels } from "./memory-utils";
import { MemoryMetric } from "./memory-metric";
import { MemorySection } from "./memory-section";

export function ReviewSection({ plan }: { plan: TradingPlanRecord }) {
  return (
    <MemorySection title="复盘结果" subtitle="用户手工填写的信息与服务端计算的收益、波动。">
      {plan.review ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MemoryMetric label="结果" value={outcomeLabels[plan.review.outcome]} />
          <MemoryMetric label="收益率" value={`${plan.review.returnPercent}%`} />
          <MemoryMetric label="最大有利波动" value={`${plan.review.maxFavorableExcursionPercent}%`} />
          <MemoryMetric label="最大不利波动" value={`${plan.review.maxAdverseExcursionPercent}%`} />
          <MemoryMetric label="持有天数" value={plan.review.holdingDays} />
          <MemoryMetric label="是否遵守计划" value={plan.review.followedPlan ? "是" : "否"} />
        </div>
      ) : (
        <p className="text-sm text-[#8B95A7]">暂无复盘。completed、cancelled、invalidated、expired 计划可创建复盘。</p>
      )}
    </MemorySection>
  );
}
