"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StockSearchCandidate, StockSearchResponse } from "@/types/stock-search";
import { isUnsupportedStockCode, shouldSearchStocks } from "./stock-search-model";

type SearchState = "idle" | "loading" | "ready" | "error";

export function StockSearchCommand() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchCandidate[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const [message, setMessage] = useState("");
  const [resolvedQuery, setResolvedQuery] = useState("");
  const normalizedQuery = query.trim();
  const canSearch = shouldSearchStocks(normalizedQuery);
  const unsupportedCode = isUnsupportedStockCode(normalizedQuery);
  const hasCurrentResult = resolvedQuery === normalizedQuery;

  useEffect(() => {
    if (!canSearch || unsupportedCode) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("loading");
      setMessage("");
      try {
        const response = await fetch(`/api/market/search?q=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as StockSearchResponse;
        if (!response.ok || !payload.success) {
          setResults([]);
          setResolvedQuery(normalizedQuery);
          setState("error");
          setMessage("搜索暂不可用");
          return;
        }
        setResults(payload.data);
        setResolvedQuery(normalizedQuery);
        setState("ready");
        setMessage(payload.data.length === 0 ? "未找到深圳主板股票" : "");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResults([]);
        setResolvedQuery(normalizedQuery);
        setState("error");
        setMessage("搜索暂不可用");
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [canSearch, normalizedQuery, unsupportedCode]);

  return (
    <div className="relative w-full lg:max-w-[420px]">
      <label className="sr-only" htmlFor="global-stock-search">
        搜索深圳主板股票
      </label>
      <input
        className="h-10 w-full rounded-md border border-[#252A33] bg-[#090A0D] px-3 text-sm text-[#F4F7FB] outline-none transition placeholder:text-[#586174] focus:border-[#7AA7FF]"
        id="global-stock-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索深圳主板股票，例如 比亚迪 / 002594"
        value={query}
      />
      {normalizedQuery && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-md border border-[#252A33] bg-[#111318] shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
          {unsupportedCode ? (
            <p className="px-3 py-3 text-sm text-[#8B95A7]">仅支持深圳主板股票（000、001、002 开头）</p>
          ) : !canSearch ? (
            <p className="px-3 py-3 text-sm text-[#8B95A7]">请输入完整代码或至少两个字符</p>
          ) : (
            <>
              {state === "loading" && !hasCurrentResult && <p className="px-3 py-3 text-sm text-[#8B95A7]">正在搜索…</p>}
              {hasCurrentResult && message && <p className="px-3 py-3 text-sm text-[#8B95A7]">{message}</p>}
              {state === "ready" && hasCurrentResult && results.map((candidate) => (
            <Link
              className="flex items-center justify-between gap-3 border-t border-[#252A33] px-3 py-3 transition hover:bg-white/[0.03]"
              href={`/stocks/${candidate.code}?mode=research`}
              key={candidate.code}
              onClick={() => setQuery("")}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#F4F7FB]">{candidate.name}</span>
                <span className="mt-0.5 block font-mono text-xs text-[#8B95A7]">{candidate.code}</span>
              </span>
              <span className="shrink-0 text-xs text-[#7AA7FF]">深圳主板</span>
            </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
