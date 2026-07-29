import type { BacktestTrade } from "@/types/backtest";

function money(value: number): string {
  return value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ReturnValue({ trade }: { trade: BacktestTrade }) {
  const positive = trade.returnPercent >= 0;
  return (
    <span className={`font-mono font-semibold ${positive ? "text-emerald-300" : "text-rose-300"}`}>
      {positive ? "+" : ""}
      {trade.returnPercent.toFixed(2)}%
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[#586174]">{label}</p>
      <p className="mt-1 font-mono text-xs text-[#DCE4F0]">{value}</p>
    </div>
  );
}

export function BacktestTradeList({ trades }: { trades: BacktestTrade[] }) {
  if (trades.length === 0)
    return (
      <section className="rounded-lg border border-dashed border-[#252A33] bg-[#111318] px-5 py-8 text-center text-sm text-[#8B95A7]">
        所选策略在该区间没有完成交易
      </section>
    );
  return (
    <section className="overflow-hidden rounded-lg border border-[#252A33] bg-[#111318]">
      <div className="border-b border-[#252A33] px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
          Trade Log
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[#F4F7FB]">交易明细</h2>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="border-b border-[#252A33] bg-[#090A0D] text-xs text-[#8B95A7]">
            <tr>
              <th className="px-5 py-3 font-medium">信号日</th>
              <th className="px-4 py-3 font-medium">买入</th>
              <th className="px-4 py-3 font-medium">卖出</th>
              <th className="px-4 py-3 font-medium">股数</th>
              <th className="px-4 py-3 font-medium">持有</th>
              <th className="px-4 py-3 font-medium">收益率</th>
              <th className="px-5 py-3 font-medium">退出原因</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr
                className="border-b border-[#252A33] last:border-0"
                key={`${trade.entryDate}-${trade.exitDate}-${trade.quantity}`}
              >
                <td className="px-5 py-4 font-mono text-xs text-[#8B95A7]">{trade.signalDate}</td>
                <td className="px-4 py-4 text-[#DCE4F0]">
                  {trade.entryDate} · {money(trade.entryPrice)}
                </td>
                <td className="px-4 py-4 text-[#DCE4F0]">
                  {trade.exitDate} · {money(trade.exitPrice)}
                </td>
                <td className="px-4 py-4 font-mono text-[#DCE4F0]">
                  {trade.quantity.toLocaleString()}
                </td>
                <td className="px-4 py-4 text-[#DCE4F0]">{trade.holdingDays} 天</td>
                <td className="px-4 py-4">
                  <ReturnValue trade={trade} />
                </td>
                <td className="px-5 py-4 text-[#8B95A7]">{trade.exitReason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 p-4 md:hidden">
        {trades.map((trade) => (
          <article
            className="rounded-lg border border-[#252A33] bg-[#090A0D] p-4"
            key={`${trade.entryDate}-${trade.exitDate}-${trade.quantity}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-xs text-[#8B95A7]">{trade.signalDate}</span>
              <ReturnValue trade={trade} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Detail label="买入" value={`${trade.entryDate} · ${money(trade.entryPrice)}`} />
              <Detail label="卖出" value={`${trade.exitDate} · ${money(trade.exitPrice)}`} />
              <Detail label="股数" value={`${trade.quantity.toLocaleString()} 股`} />
              <Detail label="持有" value={`${trade.holdingDays} 天`} />
            </div>
            <p className="mt-3 text-xs text-[#8B95A7]">{trade.exitReason}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
