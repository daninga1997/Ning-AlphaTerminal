"use client";

import { useState } from "react";
import type { StockAnalysis } from "@/types/stock";
import { getSignalPresentation } from "../../../lib/presentation/signal-presentation";

export function SaveTradingPlanButton({ stock }: { stock: StockAnalysis }) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const savePlan = async () => {
    setStatus("saving");
    setMessage("");
    const response = await fetch("/api/memory/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: stock.code,
        planType: "short_term",
        idempotencyKey: `${stock.code}-short_term-${stock.dataUpdatedAt.slice(0, 10)}-stock-detail`,
      }),
    });
    const payload = (await response.json()) as { success: boolean; data?: { id: string }; error?: { message: string } };
    if (!response.ok || !payload.success) {
      setStatus("error");
      setMessage(payload.error?.message ?? "保存失败");
      return;
    }
    setStatus("saved");
    setMessage(`已保存计划：${payload.data?.id}`);
  };

  return (
    <div className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#F4F7FB]">交易记忆</h2>
          <p className="mt-1 text-sm text-[#8B95A7]">保存当前评分、信号、建仓区和风险提示为本地交易计划。</p>
        </div>
        <button
          className="rounded-md bg-[#4F8CFF] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7AA7FF] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={status === "saving"}
          onClick={() => setIsOpen(true)}
          type="button"
        >
          保存为交易计划
        </button>
      </div>

      {isOpen ? (
        <div className="mt-4 rounded-lg border border-[#252A33] bg-[#090A0D] p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="股票" value={`${stock.name} ${stock.code}`} />
            <Metric label="计划类型" value="短线" />
            <Metric label="当前信号" value={getSignalPresentation(stock.signal).chineseLabel} />
            <Metric label="综合评分" value={stock.totalScore} />
            <Metric
              label="建仓区"
              value={`${stock.tradeLevels.firstEntryLow.toFixed(2)}-${stock.tradeLevels.firstEntryHigh.toFixed(2)}`}
            />
            <Metric label="止损位" value={stock.tradeLevels.stopLoss.toFixed(2)} />
            <Metric label="目标位" value={stock.tradeLevels.firstTarget.toFixed(2)} />
            <Metric label="风险收益比" value={stock.tradeLevels.riskRewardRatio.toFixed(2)} />
            <Metric label="建议仓位" value={stock.riskLevel === "high" ? "5%" : stock.totalScore >= 85 ? "20%" : "10%"} />
            <Metric label="数据模式" value="mock/replay演示" />
            <Metric label="更新时间" value={stock.dataUpdatedAt} />
            <Metric label="演示标识" value="演示数据" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={status === "saving"}
              onClick={savePlan}
              type="button"
            >
              确认保存
            </button>
            <button
              className="rounded-md border border-[#252A33] px-4 py-2 text-sm font-semibold text-[#DCE4F0] transition hover:bg-white/5"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              取消
            </button>
          </div>
          {message ? (
            <p className={`mt-3 text-sm ${status === "error" ? "text-red-200" : "text-emerald-200"}`}>{message}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#252A33] bg-[#111318] p-3">
      <div className="text-xs text-[#8B95A7]">{label}</div>
      <div className="mt-1 break-words font-mono text-sm font-semibold text-[#F4F7FB]">{value}</div>
    </div>
  );
}
