import type { TradingPlanRecord } from "@/server/trading-memory/trading-plan-repository";
import { MemoryMetric } from "./memory-metric";
import { MemorySection } from "./memory-section";

export function SnapshotSection({ plan }: { plan: TradingPlanRecord }) {
  return (
    <MemorySection title="原始 SignalSnapshot" subtitle="冻结创建时的行情、指标、评分和交易价格，不提供修改入口。">
      {plan.snapshot ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MemoryMetric label="快照时间" value={plan.snapshot.snapshotTime} />
          <MemoryMetric label="数据状态" value={plan.snapshot.dataStatus} />
          <MemoryMetric label="数据来源" value={plan.snapshot.dataSource} />
          <MemoryMetric label="演示标识" value={plan.snapshot.isDemo ? "演示数据" : "真实数据"} />
        </div>
      ) : (
        <p className="text-sm text-[#8B95A7]">暂无快照。</p>
      )}
    </MemorySection>
  );
}
