"use client";

import { useState } from "react";
import type { DailyBar } from "@/types/market";
import type { MarketDataMeta, MinuteBarPeriod } from "@/types/market-data";
import { MinuteTrendPanel } from "./minute-trend-panel";
import { StockPriceChart } from "./stock-price-chart";

export type ChartPeriod = "day" | MinuteBarPeriod;

export const chartPeriods = ["day", "1m", "5m", "15m", "30m", "60m"] as const satisfies readonly ChartPeriod[];

const chartPeriodLabels: Record<ChartPeriod, string> = {
  day: "日线",
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "60m": "60m",
};

export function StockChartPeriodPanel({
  code,
  bars,
  meta,
}: {
  code: string;
  bars: DailyBar[];
  meta?: MarketDataMeta;
}) {
  const [period, setPeriod] = useState<ChartPeriod>("day");

  return (
    <section aria-label="图表周期">
      <div className="mb-3 flex flex-wrap gap-2">
        {chartPeriods.map((item) => (
          <button
            className={`h-8 rounded-md border px-3 text-xs font-semibold transition-colors ${
              period === item
                ? "border-[#4F8CFF]/40 bg-[#1D2633] text-[#F4F7FB]"
                : "border-[#252A33] bg-[#090A0D] text-[#8B95A7] hover:border-[#4F8CFF]/30 hover:text-[#DCE7FF]"
            }`}
            key={item}
            onClick={() => setPeriod(item)}
            type="button"
          >
            {chartPeriodLabels[item]}
          </button>
        ))}
      </div>
      {period === "day" ? (
        <StockPriceChart bars={bars} meta={meta} />
      ) : (
        <MinuteTrendPanel code={code} period={period} />
      )}
    </section>
  );
}
