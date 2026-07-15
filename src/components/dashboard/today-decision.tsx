import Link from "next/link";
import type { StockAnalysis } from "@/types/stock";
import { ScoreBadge } from "../stocks/score-badge";
import { StockSignalBadge } from "../stocks/stock-signal-badge";
import { formatPrice, getOpportunitySummary } from "./dashboard-view-model";
import { PlanMetric, SectionTitle } from "./dashboard-primitives";

export function TodayDecision({ stock, canGenerateFullPlan = true }: { stock?: StockAnalysis; canGenerateFullPlan?: boolean }) {
  return (
    <section className="min-h-[260px] rounded-lg border border-white/10 bg-[#111722] p-5">
      <div className="flex items-start justify-between gap-4">
        <SectionTitle eyebrow="Today's Decision" title="今日核心决策" />
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
          A 级最多 1 只
        </span>
      </div>

      {!canGenerateFullPlan ? (
        <div className="mt-6 rounded-lg border border-red-300/20 bg-red-400/10 p-6">
          <div className="text-lg font-semibold text-red-200">数据完整性不足</div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-red-100">
            当前数据不能满足生成完整A级机会的条件。请检查数据来源、交易日和行情延迟。
          </p>
        </div>
      ) : stock ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h3 className="text-3xl font-semibold text-white">{stock.name}</h3>
                <p className="mt-1 font-mono text-sm text-slate-500">
                  {stock.code} · {stock.sector}
                </p>
              </div>
              <StockSignalBadge signal={stock.signal} />
              <ScoreBadge label="综合" score={stock.totalScore} />
            </div>

            <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-300">
              {getOpportunitySummary(stock)}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PlanMetric
                label="建仓区"
                value={`${formatPrice(stock.tradeLevels.firstEntryLow)}-${formatPrice(
                  stock.tradeLevels.firstEntryHigh,
                )}`}
              />
              <PlanMetric label="止损" value={formatPrice(stock.tradeLevels.stopLoss)} />
              <PlanMetric label="第一目标" value={formatPrice(stock.tradeLevels.firstTarget)} />
              <PlanMetric label="盈亏比" value={stock.tradeLevels.riskRewardRatio.toFixed(2)} />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-emerald-300/20 bg-emerald-400/8 p-4">
            <div>
              <div className="text-xs font-semibold text-emerald-100">行动建议</div>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                只在建仓区内执行；若突破追高线，等待回踩，不做情绪化追入。
              </p>
            </div>
            <Link
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              href={`/stocks/${stock.code}`}
            >
              查看详情
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-amber-300/20 bg-amber-400/10 p-6">
          <div className="text-3xl font-semibold text-white">今日不开仓</div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-100">
            当前没有满足 A 级条件的股票。保持观察，等待更清晰的主线、买点和风险收益比。
          </p>
        </div>
      )}
    </section>
  );
}
