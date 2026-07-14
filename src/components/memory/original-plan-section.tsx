import type { TradingPlanRecord } from "@/server/trading-memory/trading-plan-repository";
import { getSignalPresentation } from "../../lib/presentation/signal-presentation";
import { formatPrice, statusLabels } from "./memory-utils";
import { MemoryMetric } from "./memory-metric";
import { MemorySection } from "./memory-section";

export function OriginalPlanSection({ plan }: { plan: TradingPlanRecord }) {
  return (
    <MemorySection title="原始计划" subtitle="创建计划时知道的信息，后续评分变化不会覆盖这里。">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MemoryMetric label="原始信号" value={getSignalPresentation(plan.originalSignal).chineseLabel} />
        <MemoryMetric label="当前状态" value={statusLabels[plan.status]} />
        <MemoryMetric label="综合评分" value={plan.totalScore} />
        <MemoryMetric label="风险收益比" value={plan.riskRewardRatio.toFixed(2)} />
        <MemoryMetric label="第一建仓区" value={`${formatPrice(plan.firstEntryLow)}-${formatPrice(plan.firstEntryHigh)}`} />
        <MemoryMetric label="第二建仓区" value={`${formatPrice(plan.secondEntryLow)}-${formatPrice(plan.secondEntryHigh)}`} />
        <MemoryMetric label="止损位" value={formatPrice(plan.stopLoss)} />
        <MemoryMetric label="目标位" value={`${formatPrice(plan.firstTarget)} / ${formatPrice(plan.secondTarget)}`} />
      </div>
      <p className="mt-4 text-sm leading-6 text-[#DCE4F0]">{plan.thesis}</p>
    </MemorySection>
  );
}
