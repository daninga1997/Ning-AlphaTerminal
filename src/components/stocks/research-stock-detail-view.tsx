import Link from "next/link";
import type { ResearchStockDetail } from "@/server/market-data/research-stock-service";
import { StockPriceChart } from "./detail/stock-price-chart";

export function ResearchStockDetailView({ detail }: { detail: ResearchStockDetail }) {
  const { quote, quoteMeta, bars, dailyBarsMeta } = detail;
  const changeTone = quote.changePercent >= 0 ? "text-emerald-200" : "text-red-200";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
      <section className="rounded-lg border border-[#4F8CFF]/30 bg-[#111318] p-5">
        <Link className="text-sm font-medium text-[#7AA7FF] hover:text-white" href="/watchlist">
          返回观察池
        </Link>
        <div className="mt-4 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-[#F4F7FB]">{quote.name}</h1>
              <span className="rounded-md border border-[#252A33] bg-[#090A0D] px-3 py-1 font-mono text-sm text-[#DCE4F0]">
                {quote.code}
              </span>
              <span className="rounded-full border border-[#4F8CFF]/25 bg-[#4F8CFF]/10 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">
                研究模式
              </span>
              <span className="rounded-full border border-[#252A33] bg-[#090A0D] px-3 py-1 text-xs font-semibold text-[#DCE4F0]">
                {quote.isDemo ? "演示报价" : "真实报价"}
              </span>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#DCE4F0]">
              此股票不在 20 只核心策略观察池中，仅提供研究数据，不参与评分、交易信号、建仓计划或报告排行。
            </p>
            <p className="mt-3 text-xs text-[#8B95A7]">
              报价来源 {quoteMeta.source} · 状态 {quoteMeta.status} · 市场时间 {quote.marketTimestamp} · 接收时间 {quote.receivedAt}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
            <Metric label="当前价格" value={quote.price.toFixed(2)} />
            <Metric label="当日涨跌幅" value={`${quote.changePercent.toFixed(2)}%`} tone={changeTone} />
            <Metric label="日线数据" value={dailyBarsMeta.status} />
            <Metric label="日线更新时间" value={dailyBarsMeta.marketTimestamp ?? "不可用"} />
          </div>
        </div>
      </section>

      {bars.length > 0 ? (
        <StockPriceChart bars={bars} meta={dailyBarsMeta} />
      ) : (
        <section className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-5 text-sm text-amber-100">
          真实日线暂不可用。当前页面不会使用 Mock 或 Replay 图表替代真实日线。
        </section>
      )}

      <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">Data Boundary</p>
        <p className="mt-2 text-sm leading-6 text-[#8B95A7]">
          研究数据用于查询与观察，不构成投资建议。若要进入策略分析，股票必须由产品流程明确加入核心观察池，并通过完整性与风险控制校验。
        </p>
      </section>
    </div>
  );
}

function Metric({ label, value, tone = "text-[#F4F7FB]" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-[#252A33] bg-[#090A0D] p-3">
      <div className="text-xs text-[#8B95A7]">{label}</div>
      <div className={`mt-2 font-mono text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  );
}
