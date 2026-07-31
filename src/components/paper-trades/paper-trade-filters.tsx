"use client";

import type { PaperTradeListStatus, PaperTradeSort } from "./paper-trades-view";

export function PaperTradeFilters({
  status,
  sort,
  onStatusChange,
  onSortChange,
}: {
  status: PaperTradeListStatus;
  sort: PaperTradeSort;
  onStatusChange: (status: PaperTradeListStatus) => void;
  onSortChange: (sort: PaperTradeSort) => void;
}) {
  const options: Array<{ value: PaperTradeListStatus; label: string }> = [
    { value: "all", label: "全部" },
    { value: "open", label: "进行中" },
    { value: "closed", label: "已结算" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#252A33] bg-[#111318] p-3">
      <div aria-label="交易状态筛选" className="flex flex-wrap gap-2" role="group">
        {options.map((option) => (
          <button
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              status === option.value
                ? "bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-300/25"
                : "text-[#8B95A7] hover:bg-white/5 hover:text-[#F4F7FB]"
            }`}
            key={option.value}
            onClick={() => onStatusChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-[#8B95A7]">
        排序
        <select
          className="h-9 rounded-md border border-[#252A33] bg-[#090A0D] px-2 text-sm text-[#F4F7FB] outline-none focus:border-cyan-300"
          onChange={(event) => onSortChange(event.target.value as PaperTradeSort)}
          value={sort}
        >
          <option value="entryTime">买入时间</option>
          <option value="exitTime">卖出时间</option>
          <option value="returnPercent">收益率</option>
        </select>
      </label>
    </div>
  );
}

