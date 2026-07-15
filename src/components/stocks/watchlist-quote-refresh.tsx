"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MarketDataMeta, StockQuote } from "@/types/market-data";

type RefreshState = "idle" | "updating" | "success" | "failed";

const refreshIntervalMs = 60_000;
const manualCooldownMs = 10_000;

export function buildBatchQuoteUrl(codes: string[]): string {
  return buildBatchQuoteUrlFromKey(getQuoteCodesKey(codes));
}

export function getQuoteCodesKey(codes: string[]): string {
  return codes.join(",");
}

export function buildBatchQuoteUrlFromKey(codesKey: string): string {
  return `/api/market/quotes?codes=${codesKey}`;
}

export function shouldRestartQuoteRefresh(previousCodesKey: string, nextCodesKey: string): boolean {
  return previousCodesKey !== nextCodesKey;
}

export function shouldRefreshQuotes(isVisible: boolean): boolean {
  return isVisible;
}

type QuoteApiResponse =
  | {
      success: true;
      data: StockQuote[];
      meta: MarketDataMeta;
    }
  | {
      success: false;
      error: { code: string; message: string };
    };

export function WatchlistQuoteRefresh({
  codes,
  onFailure,
  onSuccess,
}: {
  codes: string[];
  onFailure?: () => void;
  onSuccess?: (payload: { data: StockQuote[]; meta: MarketDataMeta }) => void;
}) {
  const [state, setState] = useState<RefreshState>("idle");
  const [lastSuccessAt, setLastSuccessAt] = useState<string>("尚未刷新");
  const [coolingDown, setCoolingDown] = useState(false);
  const codesKey = useMemo(() => getQuoteCodesKey(codes), [codes]);

  const refresh = useCallback(async () => {
    if (!shouldRefreshQuotes(document.visibilityState === "visible")) return;
    setState("updating");
    try {
      const response = await fetch(buildBatchQuoteUrlFromKey(codesKey), { cache: "no-store" });
      const payload = (await response.json()) as QuoteApiResponse;
      if (!response.ok || !payload.success) throw new Error("refresh failed");
      onSuccess?.({ data: payload.data, meta: payload.meta });
      setState("success");
      setLastSuccessAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
    } catch {
      onFailure?.();
      setState("failed");
    }
  }, [codesKey, onFailure, onSuccess]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(refresh, refreshIntervalMs);
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(initial);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [codesKey, refresh]);

  function handleManualRefresh() {
    if (coolingDown) return;
    setCoolingDown(true);
    void refresh();
    window.setTimeout(() => setCoolingDown(false), manualCooldownMs);
  }

  const label = {
    idle: "等待更新",
    updating: "正在更新",
    success: "更新成功",
    failed: "更新失败",
  }[state];

  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-[#8B95A7]">
          报价批量刷新：{label} · 上次成功 {lastSuccessAt} · 页面隐藏时暂停
        </div>
        <button
          className="h-9 w-fit rounded-md border border-[#252A33] bg-[#090A0D] px-3 text-sm font-semibold text-[#F4F7FB] disabled:opacity-50"
          disabled={coolingDown}
          onClick={handleManualRefresh}
          type="button"
        >
          手动刷新
        </button>
      </div>
    </section>
  );
}
