"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MinuteBar } from "@/types/market-data";

type MinuteApiResponse = {
  success: boolean;
  data?: MinuteBar[];
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

export function MinuteTrendPanel({ code }: { code: string }) {
  const [period, setPeriod] = useState<"1m" | "5m">("1m");
  const [response, setResponse] = useState<MinuteApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await fetch(`/api/market/stocks/${code}/minutes?period=${period}&limit=120`, {
        cache: "no-store",
      });
      const json = (await result.json()) as MinuteApiResponse;
      if (!cancelled) setResponse(json);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [code, period]);

  const { latest, high, low, chartData } = useMemo(
    () => getMinuteTrendMetrics(response?.data ?? []),
    [response?.data],
  );

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
        <div className="flex gap-2">
          {(["1m", "5m"] as const).map((item) => (
            <button
              className={`h-8 rounded-md border px-3 text-xs font-semibold ${
                period === item
                  ? "border-[#4F8CFF]/40 bg-[#1D2633] text-[#F4F7FB]"
                  : "border-[#252A33] bg-[#090A0D] text-[#8B95A7]"
              }`}
              key={item}
              onClick={() => setPeriod(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

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
      <p className="mt-3 text-xs text-[#8B95A7]">
        更新时间 {response?.meta?.receivedAt ?? "--"} · 状态 {response?.meta?.status ?? "--"} · 来源{" "}
        {response?.meta?.source ?? "--"}
      </p>
    </section>
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
