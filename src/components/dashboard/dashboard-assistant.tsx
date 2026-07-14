import type { StockAnalysis } from "@/types/stock";
import type { SectorPulse } from "./dashboard-view-model";

export function DashboardAssistant({
  aLevelStock,
  strongestSector,
  hasBLevel,
}: {
  aLevelStock?: StockAnalysis;
  strongestSector?: SectorPulse;
  hasBLevel: boolean;
}) {
  const summary = aLevelStock
    ? `${aLevelStock.name} 是今日唯一 A 级机会，执行条件必须以建仓区和止损为准。`
    : strongestSector
      ? `没有 A 级机会，${strongestSector.name} 继续保持第一主线。`
      : "没有 A 级机会，不建议开仓。";

  return (
    <aside className="border-t border-white/10 bg-[#0d1118] px-4 py-4 sm:px-6 lg:px-8 xl:border-l xl:border-t-0 xl:px-5">
      <div className="xl:sticky xl:top-24">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              AI Assistant
            </p>
            <h2 className="mt-1 text-sm font-semibold text-white">今日交易助手</h2>
          </div>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100">
            演示数据
          </span>
        </div>

        <div className="mt-4 space-y-3">
          <AssistantBlock title="AI今日总结">{summary}</AssistantBlock>
          <AssistantBlock title="风险提示">
            {aLevelStock
              ? "若价格高于放弃追高价，等待回踩；若跌破止损位，本轮计划失效。"
              : "没有 A 级机会时，不为了交易而交易；B 级机会只适合观察。"}
          </AssistantBlock>
          <AssistantBlock title="今日交易纪律">
            {hasBLevel
              ? "只做计划内价格，不追高；仓位以建议区间上限为硬约束。"
              : "保持低仓或空仓，等待主线和买点同时确认。"}
          </AssistantBlock>
        </div>
      </div>
    </aside>
  );
}

function AssistantBlock({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs font-semibold text-slate-300">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{children}</p>
    </div>
  );
}
