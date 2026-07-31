"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MinuteBar, MinuteBarPeriod } from "@/types/market-data";

export type MinuteApiResponse = {
  success: boolean;
  data?: MinuteBar[];
  error?: {
    code: string;
    message?: string;
  };
  meta?: {
    source: string;
    status: string;
    mode?: string;
    receivedAt: string;
    isReplay?: boolean;
  };
};

export type MinuteTrendMetrics = {
  latest: MinuteBar | undefined;
  high: number | null;
  low: number | null;
  chartData: Array<{
    time: string;
    close: number;
    volume: number;
  }>;
};

export const AUTO_REFRESH_INTERVAL_MS = 30_000;

export type MinuteTrendViewState = "loading" | "error" | "empty" | "chart";

export function getMinuteTrendViewState({
  isLoading,
  response,
}: {
  isLoading: boolean;
  response: Pick<MinuteApiResponse, "success" | "data"> | null;
}): MinuteTrendViewState {
  if (isLoading || response === null) return "loading";
  if (!response.success) return "error";
  return response.data?.length ? "chart" : "empty";
}

export function shouldAutoRefreshMinute({
  enabled,
  mode,
  status,
}: {
  enabled: boolean;
  mode: "live" | "replay";
  status: string | undefined;
}): boolean {
  return enabled && mode === "live" && (status === "fresh" || status === "stale");
}

export function getMinuteTrendMetrics(bars: MinuteBar[]): MinuteTrendMetrics {
  return {
    latest: bars.at(-1),
    high: bars.length ? Math.max(...bars.map((bar) => bar.high)) : null,
    low: bars.length ? Math.min(...bars.map((bar) => bar.low)) : null,
    chartData: bars.map((bar) => ({
      time: bar.timestamp.slice(11, 16),
      close: bar.close,
      volume: bar.volume,
    })),
  };
}

export function buildMinuteRequestUrl(
  code: string,
  period: MinuteBarPeriod,
  mode: "live" | "replay",
): string {
  const params = new URLSearchParams({ period, limit: "120" });
  if (mode === "replay") params.set("mode", "replay");
  return `/api/market/stocks/${code}/minutes?${params.toString()}`;
}

export function MinuteTrendPanel({ code, period }: { code: string; period: MinuteBarPeriod }) {
  const [mode, setMode] = useState<"live" | "replay">("live");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [response, setResponse] = useState<MinuteApiResponse | null>(null);
  const previousRequest = useRef({ code, period, mode, refreshRevision });
  const hasLoadedRequest = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const previous = previousRequest.current;
    const isAutoRequest = hasLoadedRequest.current
      && previous.code === code
      && previous.period === period
      && previous.mode === mode
      && previous.refreshRevision !== refreshRevision;
    previousRequest.current = { code, period, mode, refreshRevision };

    async function load() {
      if (isAutoRequest) setIsRefreshing(true);
      else setIsLoading(true);
      try {
        const result = await fetch(buildMinuteRequestUrl(code, period, mode), {
          cache: "no-store",
        });
        const json = (await result.json()) as MinuteApiResponse;
        if (!cancelled) {
          setResponse(
            result.ok
              ? json
              : {
                  success: false,
                  error: json.error ?? { code: "UPSTREAM_UNAVAILABLE" },
                },
          );
        }
      } catch {
        if (!cancelled) {
          setResponse({ success: false, error: { code: "UPSTREAM_UNAVAILABLE" } });
        }
      } finally {
        if (!cancelled) {
          hasLoadedRequest.current = true;
          if (isAutoRequest) setIsRefreshing(false);
          else setIsLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [code, mode, period, refreshRevision]);

  const canAutoRefresh = shouldAutoRefreshMinute({
    enabled: autoRefresh,
    mode,
    status: response?.meta?.status,
  });

  useEffect(() => {
    if (!canAutoRefresh) return;
    const intervalId = window.setInterval(() => {
      setRefreshRevision((revision) => revision + 1);
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [canAutoRefresh]);

  const { latest, high, low, chartData } = useMemo(
    () => getMinuteTrendMetrics(response?.data ?? []),
    [response?.data],
  );
  const viewState = getMinuteTrendViewState({ isLoading, response });

  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
            Minute Trend
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#F4F7FB]">分钟走势</h2>
          <p className="mt-1 text-sm text-[#8B95A7]">用于趋势、量能和突破确认，不单独生成买入结论。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`h-8 rounded-md border px-3 text-xs font-semibold ${
              mode === "live"
                ? "border-[#4F8CFF]/40 bg-[#1D2633] text-[#F4F7FB]"
                : "border-[#252A33] bg-[#090A0D] text-[#8B95A7]"
            }`}
            onClick={() => setMode("live")}
            type="button"
          >
            Live
          </button>
          <button
            className={`h-8 rounded-md border px-3 text-xs font-semibold ${
              mode === "replay"
                ? "border-[#4F8CFF]/40 bg-[#1D2633] text-[#F4F7FB]"
                : "border-[#252A33] bg-[#090A0D] text-[#8B95A7]"
            }`}
            onClick={() => setMode("replay")}
            type="button"
          >
            Replay
          </button>
          <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-[#252A33] bg-[#090A0D] px-3 text-xs font-semibold text-[#8B95A7]">
            <input
              checked={autoRefresh}
              className="accent-[#4F8CFF]"
              onChange={(event) => setAutoRefresh(event.target.checked)}
              type="checkbox"
            />
            <span>自动刷新</span>
            <span className="font-mono text-[#586174]">30s</span>
          </label>
          {isRefreshing ? <span className="text-xs text-[#8B95A7]">刷新中...</span> : null}
        </div>
      </div>

      {viewState === "error" ? (
        <div className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-sm leading-6 text-amber-100">
          当前真实分钟数据不可用。未使用 Mock 分钟图伪装真实行情；可切换到 Replay 查看演示走势。
        </div>
      ) : null}

      {viewState === "loading" ? <MinuteTrendLoading /> : null}
      {viewState === "empty" ? <MinuteTrendEmpty /> : null}
      {viewState === "chart" ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Metric label="最新价" value={latest ? latest.close.toFixed(2) : "--"} />
            <Metric label="当日高" value={high === null ? "--" : high.toFixed(2)} />
            <Metric label="当日低" value={low === null ? "--" : low.toFixed(2)} />
            <Metric
              label="数据模式"
              value={`${response?.meta?.mode ?? "--"} ${response?.meta?.isReplay ? "历史回放" : ""}`}
            />
          </div>

          <div className="mt-4 h-48">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#252A33" strokeDasharray="3 3" />
                <XAxis dataKey="time" minTickGap={24} stroke="#8B95A7" tick={{ fontSize: 11 }} />
                <YAxis domain={["auto", "auto"]} stroke="#8B95A7" tick={{ fontSize: 11 }} width={48} />
                <Tooltip contentStyle={{ background: "#090A0D", border: "1px solid #252A33" }} />
                <Line dataKey="close" dot={false} name="最新价" stroke="#4F8CFF" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 h-24">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="#252A33" strokeDasharray="3 3" />
                <XAxis dataKey="time" minTickGap={24} stroke="#8B95A7" tick={{ fontSize: 11 }} />
                <YAxis stroke="#8B95A7" tick={{ fontSize: 11 }} width={48} />
                <Tooltip contentStyle={{ background: "#090A0D", border: "1px solid #252A33" }} />
                <Bar dataKey="volume" fill="#22C55E" name="成交量" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
      <p className="mt-3 text-xs text-[#8B95A7]">
        更新时间 {response?.meta?.receivedAt ?? "--"} · 状态 {response?.meta?.status ?? "--"} · 来源{" "}
        {response?.meta?.source ?? "--"}
      </p>
    </section>
  );
}

function MinuteTrendLoading() {
  return (
    <div className="mt-4 animate-pulse" data-testid="minute-trend-loading">
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div className="h-16 rounded-lg border border-[#252A33] bg-[#090A0D]" key={index} />)}
      </div>
      <div className="mt-4 h-48 rounded-lg border border-[#252A33] bg-[#090A0D]" />
      <div className="mt-3 h-24 rounded-lg border border-[#252A33] bg-[#090A0D]" />
    </div>
  );
}

function MinuteTrendEmpty() {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-[#3A4250] bg-[#090A0D] px-4 py-10 text-center">
      <p className="text-sm font-semibold text-[#DCE4F0]">暂无数据</p>
      <p className="mt-2 text-sm text-[#8B95A7]">当前周期尚未返回可展示的分钟 K 线。</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#252A33] bg-[#090A0D] p-3">
      <div className="text-xs text-[#8B95A7]">{label}</div>
      <div className="mt-2 font-mono text-base font-semibold text-[#F4F7FB]">{value}</div>
    </div>
  );
}
