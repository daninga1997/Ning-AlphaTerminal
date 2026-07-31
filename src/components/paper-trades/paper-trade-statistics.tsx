import type { PaperTradeStatisticsData } from "./paper-trades-view";

export function PaperTradeStatistics({ statistics }: { statistics: PaperTradeStatisticsData }) {
  const metrics = [
    { label: "总交易数", value: statistics.totalCount.toString() },
    { label: "已结算", value: statistics.settledCount.toString() },
    { label: "胜率", value: formatPercent(statistics.winRate) },
    { label: "累计收益率", value: formatPercent(statistics.totalReturnPercent) },
    { label: "平均收益率", value: formatPercent(statistics.averageReturnPercent) },
  ];

  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">Statistics</p>
      <h2 className="mt-1 text-base font-semibold text-[#F4F7FB]">模拟交易统计</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => (
          <div className="rounded-md border border-[#252A33] bg-[#090A0D] px-3 py-3" key={metric.label}>
            <p className="text-xs text-[#8B95A7]">{metric.label}</p>
            <p className="mt-1 font-mono text-lg font-semibold text-[#F4F7FB]">{metric.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-[#586174]">收益率统计仅包含已结算模拟交易，不代表账户资产回报。</p>
    </section>
  );
}

function formatPercent(value: number | null): string {
  if (value === null) return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

