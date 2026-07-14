import Link from "next/link";
import type { Report, ReportStock } from "@/types/report";
import { getEventTypeLabel, getPlanResultLabel } from "@/lib/reports/report-utils";

export function ReportStockSection({ report }: { report: Report }) {
  const aLevel = report.stocks.filter((stock) => stock.level === "A");
  const bLevel = report.stocks.filter((stock) => stock.level === "B");

  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
        Focus Stocks
      </p>
      <h2 className="mt-1 text-lg font-semibold text-[#F4F7FB]">重点股票</h2>

      {report.type === "premarket" && aLevel.length === 0 ? (
        <div className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100">
          今日不开仓
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {report.stocks.map((stock) => (
          <StockReportCard key={`${report.id}-${stock.code}`} stock={stock} />
        ))}
      </div>

      {report.type === "premarket" ? (
        <div className="mt-4 text-xs leading-5 text-[#8B95A7]">
          A级机会 {aLevel.length}/1 · B级机会 {bLevel.length}/2
        </div>
      ) : null}

      {report.intradayEvents?.length ? (
        <div className="mt-5 rounded-lg border border-[#252A33] bg-[#090A0D] p-4">
          <h3 className="text-sm font-semibold text-[#F4F7FB]">盘中异动</h3>
          <div className="mt-3 grid gap-2">
            {report.intradayEvents.map((event) => (
              <div
                className="flex flex-col gap-1 rounded-md border border-[#252A33] bg-[#111318] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                key={`${event.type}-${event.stockCode}`}
              >
                <span className="font-semibold text-[#F4F7FB]">
                  {getEventTypeLabel(event.type)} · {event.stockName}
                </span>
                <span className="text-[#8B95A7]">{event.summary}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {report.planReviews?.length ? (
        <div className="mt-5 rounded-lg border border-[#252A33] bg-[#090A0D] p-4">
          <h3 className="text-sm font-semibold text-[#F4F7FB]">计划命中情况</h3>
          <div className="mt-3 grid gap-2">
            {report.planReviews.map((review) => (
              <div
                className="flex flex-col gap-1 rounded-md border border-[#252A33] bg-[#111318] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                key={`${review.result}-${review.stockCode}`}
              >
                <span className="font-semibold text-[#F4F7FB]">
                  {getPlanResultLabel(review.result)} · {review.stockName}
                </span>
                <span className="text-[#8B95A7]">{review.summary}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StockReportCard({ stock }: { stock: ReportStock }) {
  return (
    <Link
      className="rounded-lg border border-[#252A33] bg-[#090A0D] p-4 transition hover:border-[#4F8CFF]/40 hover:bg-[#171C24]"
      href={`/stocks/${stock.code}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#F4F7FB]">{stock.name}</h3>
          <p className="mt-1 font-mono text-xs text-[#8B95A7]">
            {stock.code} · {stock.sector}
          </p>
        </div>
        <span className="rounded-full border border-[#4F8CFF]/25 bg-[#4F8CFF]/10 px-2.5 py-1 text-xs font-semibold text-[#7AA7FF]">
          {stock.level}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#DCE4F0]">{stock.summary}</p>
      <div className="mt-3 grid gap-2 text-xs leading-5 text-[#8B95A7]">
        <span>触发条件：{stock.trigger}</span>
        <span>放弃追高：{stock.chaseLimit}</span>
      </div>
    </Link>
  );
}
