import { useState } from "react";
import Link from "next/link";
import type { PaperTradeLiveQuote, PaperTradeSummary } from "./paper-trades-view";

const statusLabels: Record<PaperTradeSummary["status"], string> = {
  open: "进行中",
  take_profit: "已止盈",
  stop_loss: "已止损",
  expired: "已到期",
  manual_closed: "手动平仓",
};

const statusClassNames: Record<PaperTradeSummary["status"], string> = {
  open: "text-cyan-200",
  take_profit: "text-emerald-300",
  stop_loss: "text-rose-300",
  expired: "text-amber-300",
  manual_closed: "text-blue-300",
};

type PaperTradeListProps = {
  trades: PaperTradeSummary[];
  liveQuotesByTradeId: Record<string, PaperTradeLiveQuote | null>;
  onClose: (id: string) => Promise<boolean>;
};

export function PaperTradeList({ trades, liveQuotesByTradeId, onClose }: PaperTradeListProps) {
  const [confirmingTradeId, setConfirmingTradeId] = useState<string | null>(null);
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);

  const closeTrade = async (id: string) => {
    setClosingTradeId(id);
    const wasClosed = await onClose(id);
    if (wasClosed) setConfirmingTradeId(null);
    setClosingTradeId(null);
  };

  if (trades.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-[#252A33] bg-[#111318] px-5 py-12 text-center">
        <h2 className="text-base font-semibold text-[#F4F7FB]">暂无模拟交易记录</h2>
        <p className="mt-2 text-sm text-[#8B95A7]">在个股详情页点击“模拟买入”后，交易记录会显示在这里。</p>
      </section>
    );
  }

  return (
    <section className="overflow-x-auto rounded-lg border border-[#252A33] bg-[#111318]">
      <div className="grid min-w-[1060px] grid-cols-[minmax(132px,1.4fr)_repeat(6,minmax(92px,1fr))] gap-3 border-b border-[#252A33] px-4 py-3 text-xs text-[#586174]">
        <span>股票</span><span>买入</span><span>当前价</span><span>浮动盈亏</span><span>卖出 / 收益率</span><span>状态</span><span>操作</span>
      </div>
      <div className="divide-y divide-[#252A33]">
        {trades.map((trade) => {
          const isOpen = trade.status === "open";
          const liveQuote = isOpen ? liveQuotesByTradeId[trade.id] ?? null : null;
          const floatingReturn = liveQuote ? percent(trade.entryPrice, liveQuote.price) : null;
          const isConfirming = confirmingTradeId === trade.id;
          const isClosing = closingTradeId === trade.id;

          return (
            <div className="min-w-[1060px] px-4 py-4 text-sm" key={trade.id}>
              <div className="grid grid-cols-[minmax(132px,1.4fr)_repeat(6,minmax(92px,1fr))] gap-3">
                <Link className="min-w-0 hover:text-cyan-200" href={`/stocks/${trade.code}`}>
                  <p className="truncate font-semibold text-[#F4F7FB]">{trade.name}</p>
                  <p className="mt-1 font-mono text-xs text-[#8B95A7]">{trade.code} · {trade.sector}</p>
                </Link>
                <TradeValue time={trade.entryTime} value={formatPrice(trade.entryPrice)} />
                {isOpen ? <TradeValue time={liveQuote?.marketTimestamp ?? null} value={liveQuote ? formatPrice(liveQuote.price) : "--"} /> : <EmptyTradeValue />}
                {isOpen ? <span className={`font-mono font-semibold ${tone(floatingReturn)}`}>{formatPercent(floatingReturn)}</span> : <span />}
                <div>
                  <p className="font-mono text-[#DCE4F0]">{trade.exitPrice === null ? "--" : formatPrice(trade.exitPrice)}</p>
                  <p className={`mt-1 font-mono text-xs font-semibold ${tone(trade.returnPercent)}`}>{formatPercent(trade.returnPercent)}</p>
                </div>
                <span className={`font-medium ${statusClassNames[trade.status]}`}>{statusLabels[trade.status]}</span>
                {isOpen ? (
                  <button
                    className="rounded-md border border-amber-400/35 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isClosing}
                    onClick={() => setConfirmingTradeId(trade.id)}
                    type="button"
                  >
                    手动平仓
                  </button>
                ) : <span />}
              </div>
              {isOpen && isConfirming ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-amber-400/30 bg-amber-400/[0.06] px-3 py-3">
                  <p className="text-sm text-amber-100">当前价 {liveQuote ? formatPrice(liveQuote.price) : "--"}，确认后将按服务器重新获取的报价完成模拟平仓。</p>
                  <button
                    className="rounded-md bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!liveQuote || isClosing}
                    onClick={() => void closeTrade(trade.id)}
                    type="button"
                  >
                    {isClosing ? "平仓中..." : "确认平仓"}
                  </button>
                  <button
                    className="rounded-md border border-[#3A4250] px-3 py-2 text-xs text-[#DCE4F0] disabled:opacity-60"
                    disabled={isClosing}
                    onClick={() => setConfirmingTradeId(null)}
                    type="button"
                  >
                    取消
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TradeValue({ value, time }: { value: string; time: string | null }) {
  return <div><p className="font-mono text-[#DCE4F0]">{value}</p><p className="mt-1 text-xs text-[#586174]">{time ? formatTime(time) : "--"}</p></div>;
}

function EmptyTradeValue() {
  return <div aria-hidden="true" />;
}

function formatPrice(value: number): string {
  return value.toFixed(2);
}

function formatPercent(value: number | null): string {
  if (value === null) return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function percent(entryPrice: number, currentPrice: number): number {
  return Number((((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2));
}

function tone(value: number | null): string {
  if (value === null || value === 0) return "text-[#DCE4F0]";
  return value > 0 ? "text-emerald-300" : "text-rose-300";
}

function formatTime(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}
