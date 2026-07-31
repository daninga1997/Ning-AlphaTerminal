"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PaperTradeFilters } from "./paper-trade-filters";
import { PaperTradeList } from "./paper-trade-list";
import { PaperTradeStatistics } from "./paper-trade-statistics";

export type PaperTradeListStatus = "all" | "open" | "closed";
export type PaperTradeSort = "entryTime" | "exitTime" | "returnPercent";
export type PaperTradeSummary = {
  id: string;
  code: string;
  name: string;
  sector: string;
  entryPrice: number;
  entryTime: string;
  takeProfitPrice: number;
  stopLossPrice: number;
  status: "open" | "take_profit" | "stop_loss" | "expired" | "manual_closed";
  exitPrice: number | null;
  exitTime: string | null;
  returnPercent: number | null;
};
export type PaperTradeStatisticsData = {
  totalCount: number;
  settledCount: number;
  winRate: number | null;
  totalReturnPercent: number | null;
  averageReturnPercent: number | null;
};
export type PaperTradeLiveQuote = {
  price: number;
  marketTimestamp: string;
  source: string;
};
export type PaperTradesData = {
  trades: PaperTradeSummary[];
  statistics: PaperTradeStatisticsData;
  liveQuotesByTradeId: Record<string, PaperTradeLiveQuote | null>;
};
type PaperTradeCloseData = {
  trade: PaperTradeSummary;
  statistics: PaperTradeStatisticsData;
};

export function PaperTradesView({ initialData }: { initialData?: PaperTradesData }) {
  const [status, setStatus] = useState<PaperTradeListStatus>("all");
  const [sort, setSort] = useState<PaperTradeSort>("entryTime");
  const [data, setData] = useState<PaperTradesData | null>(initialData ?? null);
  const [error, setError] = useState<string | null>(null);
  const isRefreshingRef = useRef(false);

  const refresh = useCallback(async (nextStatus: PaperTradeListStatus, nextSort: PaperTradeSort) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      setError(null);
      const response = await fetch(`/api/paper-trades?status=${nextStatus}&sort=${nextSort}`, { cache: "no-store" });
      const payload = await response.json() as { success: boolean; data?: PaperTradesData };
      if (!response.ok || !payload.success || !payload.data) throw new Error("PAPER_TRADE_UNAVAILABLE");
      setData(payload.data);
    } catch {
      setError("模拟交易记录暂时不可用，请稍后重试。");
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void refresh(status, sort);
    };
    const initialTimer = window.setTimeout(refreshIfVisible, 0);
    const timer = window.setInterval(refreshIfVisible, 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refresh, sort, status]);

  const closeTrade = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      const response = await fetch(`/api/paper-trades/${id}/close`, { method: "POST" });
      const payload = await response.json() as { success: boolean; data?: PaperTradeCloseData; error?: { code?: string } };
      const closeData = payload.data;
      if (!response.ok || !payload.success || !closeData) throw new Error(payload.error?.code ?? "PAPER_TRADE_CLOSE_UNAVAILABLE");
      setData((current) => current ? {
        ...current,
        trades: current.trades.map((trade) => trade.id === closeData.trade.id ? closeData.trade : trade),
        statistics: closeData.statistics,
        liveQuotesByTradeId: {
          ...current.liveQuotesByTradeId,
          [closeData.trade.id]: null,
        },
      } : current);
      return true;
    } catch {
      setError("模拟平仓暂时不可用，记录保持进行中。");
      return false;
    }
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4">
      <section className="rounded-lg border border-cyan-400/20 bg-[#111318] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">Paper Trade</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#F4F7FB]">模拟交易</h1>
            <p className="mt-2 text-sm text-[#8B95A7]">仅用于记录和复盘，不会下单或连接券商。</p>
          </div>
          <p className="font-mono text-sm text-[#8B95A7]">记录 {data?.statistics.totalCount ?? "--"} 笔</p>
        </div>
      </section>
      <PaperTradeFilters onSortChange={setSort} onStatusChange={setStatus} sort={sort} status={status} />
      {error ? <p className="rounded-md border border-rose-400/25 bg-rose-400/5 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      <PaperTradeStatistics statistics={data?.statistics ?? emptyStatistics} />
      <PaperTradeList
        liveQuotesByTradeId={data?.liveQuotesByTradeId ?? {}}
        onClose={closeTrade}
        trades={data?.trades ?? []}
      />
    </div>
  );
}

const emptyStatistics: PaperTradeStatisticsData = {
  totalCount: 0,
  settledCount: 0,
  winRate: null,
  totalReturnPercent: null,
  averageReturnPercent: null,
};
