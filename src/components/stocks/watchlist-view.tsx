"use client";

import { useCallback, useMemo, useState } from "react";
import type { MarketDataMeta } from "@/types/market-data";
import type { StockAnalysis, StockFilters, StockSortField } from "@/types/stock";
import { filterStocks, getUniqueSectors, sortStocks } from "@/lib/stock-ranking";
import { StockCard } from "./stock-card";
import { StockFiltersPanel } from "./stock-filters";
import { WatchlistQuoteRefresh } from "./watchlist-quote-refresh";
import { applyQuoteRefreshFailure, mergeQuoteRefreshResult, type QuoteRefreshPayload } from "./watchlist-quotes-model";
import { getLatestWatchlistUpdate, getWatchlistStatistics } from "./watchlist-view-model";
import type { StrategyWatchlistItem } from "@/server/strategy-engine/strategy-watchlist-service";

export function WatchlistView({ stocks, strategyItems = [] }: { stocks: StockAnalysis[]; strategyItems?: StrategyWatchlistItem[] }) {
  const [liveStocks, setLiveStocks] = useState(stocks);
  const [filters, setFilters] = useState<StockFilters>({
    query: "",
    sector: "all",
    signal: "all",
  });
  const [sortField, setSortField] = useState<StockSortField>("totalScore");
  const sectors = useMemo(() => getUniqueSectors(liveStocks), [liveStocks]);
  const watchlistCodes = useMemo(() => liveStocks.map((stock) => stock.code), [liveStocks]);
  const strategyByCode = useMemo(() => new Map(strategyItems.map((item) => [item.code, item])), [strategyItems]);
  const visibleStocks = useMemo(
    () => sortStocks(filterStocks(liveStocks, filters), sortField),
    [filters, sortField, liveStocks],
  );
  const statistics = useMemo(() => getWatchlistStatistics(liveStocks), [liveStocks]);
  const updatedAt = useMemo(() => getLatestWatchlistUpdate(liveStocks), [liveStocks]);
  const marketDataMeta = (liveStocks[0] as (StockAnalysis & { marketDataMeta?: MarketDataMeta }) | undefined)
    ?.marketDataMeta;
  const handleQueryChange = useCallback((query: string) => {
    setFilters((currentFilters) => ({ ...currentFilters, query }));
  }, []);
  const handleQuoteSuccess = useCallback((payload: QuoteRefreshPayload) => {
    setLiveStocks((currentStocks) => mergeQuoteRefreshResult(currentStocks, payload));
  }, []);
  const handleQuoteFailure = useCallback(() => {
    setLiveStocks((currentStocks) => applyQuoteRefreshFailure(currentStocks));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
      <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-[#F4F7FB] sm:text-3xl">Watchlist</h1>
              <span className="rounded-full border border-[#4F8CFF]/25 bg-[#4F8CFF]/10 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">
                {marketDataMeta?.isDemo ?? true ? "演示数据" : "真实数据"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#8B95A7]">
              <span>观察股票 {stocks.length} 只</span>
              <span>当前显示 {visibleStocks.length} 只</span>
              <span>更新时间 {updatedAt}</span>
              {marketDataMeta ? (
                <span>
                  {marketDataMeta.mode ?? "mock"} · {marketDataMeta.source} · {marketDataMeta.status} · 延迟{" "}
                  {marketDataMeta.delayedSeconds ?? 0}s · 接收 {marketDataMeta.receivedAt}
                </span>
              ) : null}
            </div>
          </div>

          <label className="block">
            <span className="sr-only">搜索股票名称或代码</span>
            <input
              className="h-11 w-full rounded-md border border-[#252A33] bg-[#090A0D] px-4 text-sm text-[#F4F7FB] outline-none transition placeholder:text-[#586174] focus:border-[#7AA7FF]"
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="搜索股票名称或代码，例如 002472"
              value={filters.query}
            />
          </label>
        </div>
      </section>
      <WatchlistQuoteRefresh codes={watchlistCodes} onFailure={handleQuoteFailure} onSuccess={handleQuoteSuccess} />

      <StockFiltersPanel
        filters={filters}
        onFiltersChange={setFilters}
        onSortFieldChange={setSortField}
        sectors={sectors}
        sortField={sortField}
      />

      {visibleStocks.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visibleStocks.map((stock) => (
            <StockCard key={stock.code} stock={stock} strategyItem={strategyByCode.get(stock.code)} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-[#252A33] bg-[#111318] p-6 text-center text-sm text-[#8B95A7]">
          没有匹配的观察股，请调整搜索或筛选条件。
        </div>
      )}

      <section className="rounded-lg border border-[#252A33] bg-[#111318] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
              Statistics
            </p>
            <h2 className="mt-1 text-base font-semibold text-[#F4F7FB]">观察池统计</h2>
          </div>
          <div className="font-mono text-sm font-semibold text-[#F4F7FB]">
            平均综合评分 {statistics.averageTotalScore}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <StatCard label="可以买" tone="buy" value={statistics.buy} />
          <StatCard label="等待" tone="wait" value={statistics.wait} />
          <StatCard label="持股" tone="hold" value={statistics.hold} />
          <StatCard label="减仓" tone="reduce" value={statistics.reduce} />
          <StatCard label="回避" tone="avoid" value={statistics.avoid} />
          <StatCard label="平均综合评分" value={statistics.averageTotalScore} />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "buy" | "wait" | "hold" | "reduce" | "avoid";
  value: number;
}) {
  const toneClassNames = {
    buy: "text-emerald-100",
    wait: "text-amber-100",
    hold: "text-blue-100",
    reduce: "text-orange-100",
    avoid: "text-red-100",
  };

  return (
    <div className="rounded-lg border border-[#252A33] bg-[#090A0D] px-4 py-3">
      <div className="text-xs text-[#8B95A7]">{label}</div>
      <div
        className={`mt-2 font-mono text-xl font-semibold ${tone ? toneClassNames[tone] : "text-[#F4F7FB]"}`}
      >
        {value}
      </div>
    </div>
  );
}
