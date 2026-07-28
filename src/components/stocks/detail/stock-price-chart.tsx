"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyBar } from "@/types/market";
import type { MarketDataMeta } from "@/types/market-data";
import { calculateSma } from "../../../lib/indicators";

type ChartPoint = {
  date: string;
  close: number;
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  volume: number;
};

export function makeStockPriceChartData(bars: DailyBar[]): ChartPoint[] {
  return bars.map((bar, index) => {
    const closes = bars.slice(0, index + 1).map((item) => item.close);
    return {
      date: bar.date.slice(5),
      close: bar.close,
      ma5: calculateSma(closes, 5),
      ma10: calculateSma(closes, 10),
      ma20: calculateSma(closes, 20),
      volume: Math.round(bar.volume / 10000),
    };
  });
}

export function StockPriceChart({ bars, meta }: { bars: DailyBar[]; meta?: MarketDataMeta }) {
  const data = useMemo(() => makeStockPriceChartData(bars), [bars]);

  return (
    <section className="overflow-hidden rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
            Price Chart
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#F4F7FB]">价格走势</h2>
        </div>
        <span className="w-fit rounded-full border border-[#4F8CFF]/25 bg-[#4F8CFF]/10 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">
          {meta?.isDemo ?? true ? "120日模拟数据" : `${bars.length}日真实日线`}
        </span>
      </div>

      <p className="mt-3 text-xs text-[#8B95A7]">
        {meta?.isDemo ?? true ? "当前图表为 Replay/Mock 演示历史快照，不是真实分钟行情。" : "当前图表使用真实日线数据。"} ·{" "}
        {meta?.source ?? "Mock"}
      </p>
      {!(meta?.isDemo ?? true) && (
        <p className="mt-1 text-xs text-[#586174]">
          📊 数据来源：腾讯财经 | 分钟级数据暂不可用，以日线趋势为准
        </p>
      )}

      <div className="mt-5 h-[300px] min-w-0 sm:h-[360px]">
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart data={data}>
            <CartesianGrid stroke="#252A33" strokeDasharray="3 3" />
            <XAxis dataKey="date" minTickGap={28} stroke="#8B95A7" tick={{ fontSize: 11 }} />
            <YAxis domain={["auto", "auto"]} stroke="#8B95A7" tick={{ fontSize: 11 }} width={48} />
            <Tooltip
              contentStyle={{ background: "#090A0D", border: "1px solid #252A33" }}
              labelStyle={{ color: "#F4F7FB" }}
            />
            <Legend />
            <Line dataKey="close" dot={false} name="收盘价" stroke="#F4F7FB" strokeWidth={2} />
            <Line dataKey="ma5" dot={false} name="MA5" stroke="#4F8CFF" strokeWidth={1.5} />
            <Line dataKey="ma10" dot={false} name="MA10" stroke="#22C55E" strokeWidth={1.5} />
            <Line dataKey="ma20" dot={false} name="MA20" stroke="#F59E0B" strokeWidth={1.5} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 h-28 min-w-0">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="#252A33" strokeDasharray="3 3" />
            <XAxis dataKey="date" minTickGap={28} stroke="#8B95A7" tick={{ fontSize: 11 }} />
            <YAxis stroke="#8B95A7" tick={{ fontSize: 11 }} width={48} />
            <Tooltip
              contentStyle={{ background: "#090A0D", border: "1px solid #252A33" }}
              labelStyle={{ color: "#F4F7FB" }}
            />
            <Bar dataKey="volume" fill="#4F8CFF" name="成交量(万)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
