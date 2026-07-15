import type { StrategyWatchlistItem } from "@/server/strategy-engine/strategy-watchlist-service";
import type { StrategyEngineOutput } from "@/server/strategy-engine/types/strategy-result";
import type { StrategyTradePlan } from "@/server/strategy-engine/types/trade-plan";

const actionText: Record<StrategyTradePlan["currentAction"], string> = {
  focus: "重点关注",
  wait_for_pullback: "等待回踩",
  breakout_watch: "等待突破",
  buy_allowed: "允许试仓",
  hold: "持有",
  reduce: "减仓",
  avoid: "回避",
  data_blocked: "数据不足",
};

const strategyText: Record<NonNullable<StrategyTradePlan["primaryStrategy"]>, string> = {
  leader_first_yin_v1: "龙头首阴修复",
  late_session_momentum_v1: "尾盘趋势确认",
  trend_swing_v1: "趋势波段",
};

export function DashboardStrategyCandidates({ items }: { items: StrategyWatchlistItem[] }) {
  const eligible = items
    .filter((item) => item.finalPlan.currentAction !== "data_blocked")
    .sort((a, b) => b.finalPlan.dataCompleteness - a.finalPlan.dataCompleteness || b.finalPlan.riskRewardRatio - a.finalPlan.riskRewardRatio);
  const aLevel = eligible.filter((item) => item.finalPlan.grade === "A" || item.finalPlan.grade === "S").slice(0, 1);
  const bLevel = eligible.filter((item) => item.finalPlan.grade === "B").slice(0, 2);
  const display = [...aLevel, ...bLevel];

  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">Strategy Candidates</p>
          <h2 className="mt-1 text-base font-semibold text-[#F4F7FB]">今日策略候选</h2>
        </div>
        <span className="rounded-full border border-[#252A33] px-3 py-1 text-xs text-[#8B95A7]">A≤1 · B≤2</span>
      </div>
      {display.length === 0 ? (
        <div className="rounded-md border border-[#252A33] bg-[#090A0D] p-3 text-sm text-[#8B95A7]">
          当前没有满足A级或B级条件的策略候选，不凑数。
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {display.map((item) => <StrategyCandidateCard item={item} key={item.code} />)}
        </div>
      )}
    </section>
  );
}

export function StockStrategyPanel({ output }: { output: StrategyEngineOutput | null }) {
  if (!output) {
    return (
      <section className="rounded-lg border border-[#252A33] bg-[#111318] p-4 text-sm text-[#8B95A7]">
        策略引擎暂不可用。
      </section>
    );
  }

  const plan = output.finalPlan;
  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">Strategy Conclusion</p>
          <h2 className="mt-1 text-lg font-semibold text-[#F4F7FB]">{actionText[plan.currentAction]}</h2>
        </div>
        <span className="rounded-full border border-[#4F8CFF]/30 bg-[#4F8CFF]/10 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">
          {plan.primaryStrategy ? strategyText[plan.primaryStrategy] : "无主策略"} · {plan.grade}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <StrategyMetric label="关注区" value={`${plan.watchZone.low.toFixed(2)}-${plan.watchZone.high.toFixed(2)}`} />
        <StrategyMetric label="放弃追高" value={plan.chaseLimit.price.toFixed(2)} />
        <StrategyMetric label="盈亏比" value={plan.riskRewardRatio.toFixed(2)} />
        <StrategyMetric label="建议仓位" value={`${plan.suggestedPositionPercent}%`} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ListBlock items={plan.triggerConditions} title="买入触发条件" />
        <ListBlock items={plan.cancellationConditions} title="取消条件" />
      </div>
      {plan.invalidReasons.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
          {plan.invalidReasons.slice(0, 3).join(" / ")}
        </div>
      ) : null}
    </section>
  );
}

export function ReportsStrategySection({ items }: { items: StrategyWatchlistItem[] }) {
  const top = [...items].sort((a, b) => b.finalPlan.dataCompleteness - a.finalPlan.dataCompleteness).slice(0, 5);
  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">Structured Strategy Results</p>
      <h2 className="mt-1 text-base font-semibold text-[#F4F7FB]">策略结构化结果</h2>
      <div className="mt-3 grid gap-2">
        {top.map((item) => (
          <div className="grid gap-2 rounded-md border border-[#252A33] bg-[#090A0D] p-3 text-sm md:grid-cols-[120px_1fr_120px]" key={item.code}>
            <span className="font-semibold text-[#F4F7FB]">{item.name} {item.code}</span>
            <span className="text-[#8B95A7]">{item.finalPlan.primaryStrategy ? strategyText[item.finalPlan.primaryStrategy] : "无主策略"} · {actionText[item.finalPlan.currentAction]}</span>
            <span className="font-mono text-[#DCE4F0]">{item.integrity.permission}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StrategyCandidateCard({ item }: { item: StrategyWatchlistItem }) {
  const plan = item.finalPlan;
  return (
    <div className="rounded-md border border-[#252A33] bg-[#090A0D] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-[#F4F7FB]">{item.name}</div>
        <div className="font-mono text-xs text-[#8B95A7]">{item.code}</div>
      </div>
      <div className="mt-2 text-sm text-[#DCE4F0]">{actionText[plan.currentAction]}</div>
      <div className="mt-2 text-xs leading-5 text-[#8B95A7]">
        {plan.primaryStrategy ? strategyText[plan.primaryStrategy] : "无主策略"} · 关注区 {plan.watchZone.low.toFixed(2)}-{plan.watchZone.high.toFixed(2)}
      </div>
    </div>
  );
}

function StrategyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#252A33] bg-[#090A0D] p-3">
      <div className="text-xs text-[#8B95A7]">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold text-[#F4F7FB]">{value}</div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-[#252A33] bg-[#090A0D] p-3">
      <div className="text-xs font-semibold text-[#8B95A7]">{title}</div>
      <ul className="mt-2 space-y-1 text-sm text-[#DCE4F0]">
        {(items.length > 0 ? items : ["暂无，等待数据完整"]).slice(0, 4).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
