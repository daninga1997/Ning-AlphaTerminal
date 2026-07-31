"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PaperTradeStatus = "open" | "take_profit" | "stop_loss" | "expired" | "manual_closed";

type PaperTrade = {
  id: string;
  entryPrice: number;
  entryTime: string;
  takeProfitPrice: number;
  stopLossPrice: number;
  status: PaperTradeStatus;
  exitPrice: number | null;
  exitTime: string | null;
  returnPercent: number | null;
  settlementReason: string | null;
};

export type PaperTradeData = {
  latestQuotePrice: number | null;
  latestQuoteTimestamp: string | null;
  trades: PaperTrade[];
};

export function getPaperTradeLoadData(
  responseOk: boolean,
  payload: { success: boolean; data?: PaperTradeData },
): PaperTradeData | null {
  return responseOk && payload.success && payload.data ? payload.data : null;
}

export function PaperTradePanel({ code, initialData }: { code: string; initialData?: PaperTradeData }) {
  const [data, setData] = useState<PaperTradeData | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState(initialData === undefined);
  const [isBuying, setIsBuying] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isCloseConfirming, setIsCloseConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async (isInitialRequest = false) => {
    if (isInitialRequest) setIsLoading(true);
    try {
      const response = await fetch(`/api/paper-trades?code=${code}`, { cache: "no-store" });
      const payload = await response.json() as { success: boolean; data?: PaperTradeData };
      const nextData = getPaperTradeLoadData(response.ok, payload);
      if (!nextData) throw new Error("PAPER_TRADE_UNAVAILABLE");
      setData(nextData);
    } catch {
      setMessage((current) => current === "模拟交易记录暂时不可用" ? current : "模拟交易记录暂时不可用");
    } finally {
      if (isInitialRequest) setIsLoading(false);
    }
  }, [code]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(true), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const openTrade = useMemo(() => data?.trades.find((trade) => trade.status === "open") ?? null, [data]);

  const buy = async () => {
    setIsBuying(true);
    setMessage(null);
    try {
      const response = await fetch("/api/paper-trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json() as { success: boolean; error?: { code?: string } };
      if (!response.ok || !payload.success) {
        setMessage(messageForError(payload.error?.code));
        return;
      }
      setMessage("已记录模拟买入，不会发送任何订单。");
      await refresh();
    } catch {
      setMessage("模拟买入暂时不可用");
    } finally {
      setIsBuying(false);
    }
  };

  const close = async () => {
    if (!openTrade) return;
    setIsClosing(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/paper-trades/${openTrade.id}/close`, { method: "POST" });
      const payload = await response.json() as { success: boolean; error?: { code?: string } };
      if (!response.ok || !payload.success) {
        setMessage(messageForCloseError(payload.error?.code));
        return;
      }
      setMessage("已按当前服务器报价完成模拟平仓，不会发送任何订单。");
      setIsCloseConfirming(false);
      await refresh();
    } catch {
      setMessage("模拟平仓暂时不可用。");
    } finally {
      setIsClosing(false);
    }
  };

  const latest = data?.trades.slice(0, 3) ?? [];

  return (
    <section className="rounded-lg border border-cyan-400/20 bg-[#111318] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">Paper Trade</p>
          <h2 className="mt-1 text-lg font-semibold text-[#F4F7FB]">模拟交易</h2>
          <p className="mt-1 text-sm text-[#8B95A7]">仅记录和复盘，不会下单或连接券商。</p>
        </div>
        {isLoading ? <div aria-hidden="true" className="h-10 w-24 animate-pulse rounded-md bg-[#252A33]" /> : <div className="flex flex-wrap gap-2">
        {openTrade ? (
          <button
            className="w-fit rounded-md border border-amber-400/35 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isClosing}
            onClick={() => setIsCloseConfirming(true)}
            type="button"
          >
            手动平仓
          </button>
        ) : null}
        <button
          className="w-fit rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBuying || Boolean(openTrade)}
          onClick={buy}
          type="button"
        >
          {isBuying ? "记录中..." : openTrade ? "已有模拟持仓" : "模拟买入"}
        </button>
        </div>}
      </div>

      {isLoading ? <PaperTradeLoading /> : null}

      {!isLoading && openTrade ? (
        <div className="mt-4 grid gap-3 rounded-lg border border-cyan-400/15 bg-cyan-400/[0.04] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="模拟买入价" value={formatPrice(openTrade.entryPrice)} />
          <Metric label="当前模拟价" value={data?.latestQuotePrice ? formatPrice(data.latestQuotePrice) : "报价不可用"} />
          <Metric label="浮动盈亏" value={data?.latestQuotePrice ? formatPercent(percent(openTrade.entryPrice, data.latestQuotePrice)) : "--"} tone={data?.latestQuotePrice ? tone(percent(openTrade.entryPrice, data.latestQuotePrice)) : "neutral"} />
          <Metric label="止盈 / 止损" value={`${formatPrice(openTrade.takeProfitPrice)} / ${formatPrice(openTrade.stopLossPrice)}`} />
        </div>
      ) : null}

      {!isLoading && openTrade && isCloseConfirming ? (
        <div className="mt-4 rounded-md border border-amber-400/30 bg-amber-400/[0.06] p-4">
          <p className="text-sm font-semibold text-amber-100">确认按当前服务器报价模拟平仓？</p>
          <p className="mt-1 text-sm text-[#B7C0D0]">确认后将记录卖出价、卖出时间和收益率，且不能恢复为进行中。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-md bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              disabled={isClosing}
              onClick={close}
              type="button"
            >
              {isClosing ? "平仓中..." : "确认平仓"}
            </button>
            <button
              className="rounded-md border border-[#3A4250] px-3 py-2 text-sm text-[#DCE4F0]"
              disabled={isClosing}
              onClick={() => setIsCloseConfirming(false)}
              type="button"
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      {!isLoading && latest.length > 0 ? (
        <div className="mt-4 space-y-2">
          {latest.map((trade) => (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#252A33] bg-[#090A0D] px-3 py-2 text-sm" key={trade.id}>
              <span className="font-mono text-[#DCE4F0]">买入 {formatPrice(trade.entryPrice)}</span>
              <span className={statusTone(trade.status)}>{statusLabel(trade.status)}</span>
              <span className="text-[#8B95A7]">{trade.exitPrice ? `结算 ${formatPrice(trade.exitPrice)}` : "持续跟踪"}</span>
              <span className={tone(trade.returnPercent)}>{trade.returnPercent === null ? "--" : formatPercent(trade.returnPercent)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && data?.latestQuoteTimestamp ? <p className="mt-3 text-xs text-[#586174]">报价更新时间 {data.latestQuoteTimestamp.slice(0, 19).replace("T", " ")}</p> : null}
      {message ? <p aria-live="polite" className="mt-3 text-sm text-cyan-100">{message}</p> : null}
    </section>
  );
}

function PaperTradeLoading() {
  return (
    <div className="mt-4 animate-pulse" data-testid="paper-trade-loading">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div className="h-16 rounded-lg border border-[#252A33] bg-[#090A0D]" key={index} />)}
      </div>
      <div className="mt-4 h-12 rounded-md border border-[#252A33] bg-[#090A0D]" />
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" }) {
  const color = tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-rose-300" : "text-[#F4F7FB]";
  return <div><p className="text-xs text-[#8B95A7]">{label}</p><p className={`mt-1 font-mono text-sm font-semibold ${color}`}>{value}</p></div>;
}

function percent(entryPrice: number, price: number): number {
  return Number((((price - entryPrice) / entryPrice) * 100).toFixed(2));
}

function formatPrice(value: number): string {
  return value.toFixed(2);
}

function formatPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function tone(value: number | null): "positive" | "negative" | "neutral" {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function messageForCloseError(code?: string): string {
  if (code === "PAPER_TRADE_NOT_OPEN") return "该模拟交易已经结算，无法再次平仓。";
  if (code === "PAPER_TRADE_NOT_FOUND") return "模拟交易记录不存在或已删除。";
  if (code === "PAPER_TRADE_QUOTE_UNAVAILABLE") return "当前真实报价不可用，模拟交易保持进行中。";
  return "模拟平仓未完成，请稍后重试。";
}

function statusLabel(status: PaperTradeStatus): string {
  if (status === "manual_closed") return "手动平仓";
  return { open: "模拟持仓", take_profit: "模拟止盈", stop_loss: "模拟止损", expired: "模拟到期" }[status];
}

function statusTone(status: PaperTradeStatus): string {
  if (status === "manual_closed") return "text-blue-300";
  return status === "take_profit" ? "text-emerald-300" : status === "stop_loss" ? "text-rose-300" : status === "expired" ? "text-amber-300" : "text-cyan-200";
}

function messageForError(code?: string): string {
  if (code === "PAPER_TRADE_QUOTE_UNAVAILABLE") return "当前真实报价不可用，未创建模拟交易。";
  if (code === "PAPER_TRADE_LEVELS_UNAVAILABLE") return "当前策略价格不可用，未创建模拟交易。";
  return "模拟买入未完成，请稍后重试。";
}
