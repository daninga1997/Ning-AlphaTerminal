"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BacktestEquityPoint } from "@/types/backtest";

export function BacktestEquityChart({ points }: { points: BacktestEquityPoint[] }) {
  const data = points.map((point) => ({ ...point, label: point.date.slice(5) }));
  return (
    <section className="overflow-hidden rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#586174]">
            Equity Curve
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#F4F7FB]">资金曲线</h2>
        </div>
        <span className="rounded-full border border-[#4F8CFF]/25 bg-[#4F8CFF]/10 px-3 py-1 text-xs font-semibold text-[#7AA7FF]">
          日线回测
        </span>
      </div>
      <div className="mt-5 h-64 min-w-0 sm:h-80">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#252A33" strokeDasharray="3 3" />
            <XAxis dataKey="label" minTickGap={28} stroke="#8B95A7" tick={{ fontSize: 11 }} />
            <YAxis
              dataKey="equity"
              domain={["auto", "auto"]}
              stroke="#8B95A7"
              tick={{ fontSize: 11 }}
              width={68}
            />
            <Tooltip
              contentStyle={{ background: "#090A0D", border: "1px solid #252A33" }}
              formatter={(value) => [typeof value === "number" ? value.toFixed(2) : value, "权益"]}
              labelStyle={{ color: "#F4F7FB" }}
            />
            <Line
              dataKey="equity"
              dot={false}
              name="权益"
              stroke="#4F8CFF"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
