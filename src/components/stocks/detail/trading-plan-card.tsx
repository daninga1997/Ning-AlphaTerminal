import type { StockAnalysis } from "@/types/stock";
import { hasCalculatedTradeLevels } from "../../../lib/trading/trade-levels";
import { getDecisionSummary } from "./decision-summary";

export function TradingPlanCard({ stock }: { stock: StockAnalysis }) {
  const levels = stock.tradeLevels;
  const decision = getDecisionSummary(stock);
  const hasPlan = hasCalculatedTradeLevels(levels);

  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
            Trading Plan
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#F4F7FB]">交易计划</h2>
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
            decision.isOpenAllowed
              ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-100"
              : "border-amber-400/30 bg-amber-400/12 text-amber-100"
          }`}
        >
          {decision.actionLabel}
        </span>
      </div>

      {levels.invalidReason ? (
        <div className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          当前不开仓：{levels.invalidReason}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PlanMetric
          label="第一建仓区"
          value={hasPlan ? `${levels.firstEntryLow.toFixed(2)} - ${levels.firstEntryHigh.toFixed(2)}` : "数据不足"}
        />
        <PlanMetric
          label="第二建仓区"
          value={hasPlan ? `${levels.secondEntryLow.toFixed(2)} - ${levels.secondEntryHigh.toFixed(2)}` : "数据不足"}
        />
        <PlanMetric label="放弃追高价" value={hasPlan ? levels.chaseLimit.toFixed(2) : "数据不足"} />
        <PlanMetric label="止损位" value={hasPlan ? levels.stopLoss.toFixed(2) : "数据不足"} />
        <PlanMetric label="第一目标位" value={hasPlan ? levels.firstTarget.toFixed(2) : "数据不足"} />
        <PlanMetric label="第二目标位" value={hasPlan ? levels.secondTarget.toFixed(2) : "数据不足"} />
        <PlanMetric label="风险收益比" value={hasPlan ? levels.riskRewardRatio.toFixed(2) : "数据不足"} />
        <PlanMetric label="建议操作状态" value={decision.actionLabel} />
      </div>

      <div className="mt-5 rounded-lg border border-[#252A33] bg-[#090A0D] p-4">
        <h3 className="text-sm font-semibold text-[#F4F7FB]">交易纪律</h3>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#DCE4F0] md:grid-cols-2">
          <li>不在放弃追高价以上追入</li>
          <li>未触及建仓条件不提前开仓</li>
          <li>跌破止损位代表当前计划失效</li>
          <li>演示结果不构成投资建议</li>
        </ul>
      </div>
    </section>
  );
}

function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#252A33] bg-[#090A0D] p-3">
      <div className="text-xs text-[#8B95A7]">{label}</div>
      <div className="mt-2 font-mono text-lg font-semibold text-[#F4F7FB]">{value}</div>
    </div>
  );
}
