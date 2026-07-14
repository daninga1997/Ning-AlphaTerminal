import type { calculateTradingMemoryStats } from "@/server/trading-memory/trading-memory-stats";

type Stats = ReturnType<typeof calculateTradingMemoryStats>;

export function MemoryStatsSummary({ stats }: { stats: Stats }) {
  const items = [
    ["总计划数", stats.totalPlans],
    ["已触发", stats.triggeredPlans],
    ["已完成", stats.completedPlans],
    ["止损", stats.stoppedOutPlans],
    ["胜率", `${stats.winRate}%`],
    ["平均收益", `${stats.averageReturnPercent}%`],
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map(([label, value]) => (
        <div className="rounded-lg border border-[#252A33] bg-[#111318] p-4" key={label}>
          <div className="text-xs text-[#8B95A7]">{label}</div>
          <div className="mt-2 font-mono text-xl font-semibold text-[#F4F7FB]">{value}</div>
        </div>
      ))}
      {stats.smallSampleWarning ? (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100 sm:col-span-2 xl:col-span-6">
          小样本，仅供复盘参考。胜率不等同于模型未来成功概率。
        </div>
      ) : null}
    </section>
  );
}
