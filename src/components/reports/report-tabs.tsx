"use client";

import type { ReportType } from "@/types/report";

const tabs: Array<{ type: ReportType; label: string }> = [
  { type: "premarket", label: "盘前报告" },
  { type: "intraday", label: "盘中报告" },
  { type: "postmarket", label: "盘后报告" },
];

export function ReportTabs({
  activeType,
  onChange,
}: {
  activeType: ReportType;
  onChange: (type: ReportType) => void;
}) {
  return (
    <div className="rounded-lg border border-[#252A33] bg-[#111318] p-2">
      <div className="grid gap-2 sm:grid-cols-3">
        {tabs.map((tab) => (
          <button
            className={`h-10 rounded-md px-4 text-sm font-semibold transition ${
              activeType === tab.type
                ? "bg-[#1D2633] text-[#F4F7FB]"
                : "text-[#8B95A7] hover:bg-[#171C24] hover:text-[#F4F7FB]"
            }`}
            key={tab.type}
            onClick={() => onChange(tab.type)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
