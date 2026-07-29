import type { BacktestReport } from "@/types/backtest";

function currency(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(value);
}

function percent(value: number | null): string {
  return value === null ? "--" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function BacktestSummary({ report }: { report: BacktestReport }) {
  const metrics = [
    { label: "初始资金", value: currency(report.initialCapital), tone: "text-[#DCE4F0]" },
    { label: "期末权益", value: currency(report.finalEquity), tone: "text-[#F4F7FB]" },
    {
      label: "总收益率",
      value: percent(report.totalReturnPercent),
      tone: report.totalReturnPercent >= 0 ? "text-emerald-300" : "text-rose-300",
    },
    {
      label: "年化收益率",
      value: percent(report.annualizedReturnPercent),
      tone: report.annualizedReturnPercent >= 0 ? "text-emerald-300" : "text-rose-300",
    },
    {
      label: "最大回撤",
      value: `${report.maxDrawdownPercent.toFixed(2)}%`,
      tone: "text-amber-300",
    },
    { label: "胜率", value: percent(report.winRatePercent), tone: "text-[#DCE4F0]" },
    {
      label: "盈亏比",
      value: report.profitLossRatio === null ? "无亏损样本" : report.profitLossRatio.toFixed(2),
      tone: "text-[#DCE4F0]",
    },
    { label: "完成交易", value: `${report.completedTradeCount} 次`, tone: "text-[#DCE4F0]" },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div
          className="min-h-24 rounded-lg border border-[#252A33] bg-[#111318] p-4"
          key={metric.label}
        >
          <p className="text-xs text-[#8B95A7]">{metric.label}</p>
          <p className={`mt-3 break-words font-mono text-lg font-semibold ${metric.tone}`}>
            {metric.value}
          </p>
        </div>
      ))}
    </section>
  );
}
