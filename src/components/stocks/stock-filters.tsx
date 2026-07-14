"use client";

import { memo } from "react";
import type { StockFilters, StockSignal, StockSortField } from "@/types/stock";
import { getSignalPresentation } from "../../lib/presentation/signal-presentation";
import { sortFieldLabels } from "../../lib/stock-ranking";

type StockFiltersPanelProps = {
  filters: StockFilters;
  sectors: string[];
  sortField: StockSortField;
  onFiltersChange: (filters: StockFilters) => void;
  onSortFieldChange: (field: StockSortField) => void;
};

const sortFields: StockSortField[] = ["totalScore", "shortTermScore", "midTermScore", "changePercent"];

const signalOptions: Array<StockSignal | "all"> = ["all", "buy", "wait", "hold", "reduce", "avoid"];

function getSectorLabel(sector: string): string {
  if (sector === "创新药/医药") return "创新药";
  if (sector === "军工和高端制造") return "军工";
  return sector;
}

function optionClassName(isActive: boolean, toneClassName = "border-[#252A33] text-[#DCE4F0]") {
  return [
    "h-9 rounded-full border px-3 text-xs font-semibold transition duration-150",
    isActive ? "bg-[#1D2633]" : "bg-[#111318] hover:bg-[#171C24]",
    toneClassName,
  ].join(" ");
}

function getSignalFilterLabel(signal: StockSignal | "all"): string {
  return signal === "all" ? "全部" : getSignalPresentation(signal).chineseLabel;
}

function getSignalFilterClassName(signal: StockSignal | "all"): string {
  return signal === "all"
    ? "border-[#252A33] text-[#DCE4F0]"
    : getSignalPresentation(signal).badgeClassName.replace(/bg-[^\s]+/g, "");
}

export const StockFiltersPanel = memo(function StockFiltersPanel({
  filters,
  sectors,
  sortField,
  onFiltersChange,
  onSortFieldChange,
}: StockFiltersPanelProps) {
  return (
    <section className="rounded-lg border border-[#252A33] bg-[#111318] p-4">
      <div className="grid gap-4">
        <FilterGroup label="信号">
          {signalOptions.map((signal) => (
            <button
              className={optionClassName(filters.signal === signal, getSignalFilterClassName(signal))}
              key={signal}
              onClick={() => onFiltersChange({ ...filters, signal })}
              type="button"
            >
              {getSignalFilterLabel(signal)}
            </button>
          ))}
        </FilterGroup>

        <FilterGroup label="板块">
          <button
            className={optionClassName(filters.sector === "all")}
            onClick={() => onFiltersChange({ ...filters, sector: "all" })}
            type="button"
          >
            全部板块
          </button>
          {sectors.map((sector) => (
            <button
              className={optionClassName(filters.sector === sector)}
              key={sector}
              onClick={() => onFiltersChange({ ...filters, sector })}
              type="button"
            >
              {getSectorLabel(sector)}
            </button>
          ))}
        </FilterGroup>

        <FilterGroup label="排序">
          {sortFields.map((field) => (
            <button
              className={optionClassName(sortField === field)}
              key={field}
              onClick={() => onSortFieldChange(field)}
              type="button"
            >
              {sortFieldLabels[field]}
            </button>
          ))}
        </FilterGroup>
      </div>
    </section>
  );
});

function FilterGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="grid gap-2 lg:grid-cols-[72px_minmax(0,1fr)] lg:items-center">
      <div className="text-xs font-semibold text-[#8B95A7]">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
