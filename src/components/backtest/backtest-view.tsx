"use client";

import { FormEvent, useCallback, useState } from "react";
import { runBacktest } from "@/lib/backtest/backtest-engine";
import type { BacktestHistoryResponse, BacktestReport, BacktestStrategyId } from "@/types/backtest";
import { BacktestEquityChart } from "./backtest-equity-chart";
import { BacktestSummary } from "./backtest-summary";
import { BacktestTradeList } from "./backtest-trade-list";
import { resolveBacktestViewState } from "./backtest-view-state";

const strategies: Array<{ id: BacktestStrategyId; label: string }> = [
  { id: "breakout", label: "突破" },
  { id: "ema_cross", label: "均线交叉" },
  { id: "trend_swing_compatible", label: "趋势波段兼容" },
  { id: "leader_first_yin", label: "龙头首阴修复" },
  { id: "late_session_daily", label: "尾盘趋势(日线)" },
];

const initialDates = defaultDates();

export function BacktestView() {
  const [code, setCode] = useState("002472");
  const [start, setStart] = useState(initialDates.start);
  const [end, setEnd] = useState(initialDates.end);
  const [strategy, setStrategy] = useState<BacktestStrategyId>("breakout");
  const [breakoutLookback, setBreakoutLookback] = useState(20);
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [history, setHistory] = useState<BacktestHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const run = useCallback(async () => {
    const normalizedCode = code.trim();
    if (!/^(000|001|002)\d{3}$/.test(normalizedCode)) {
      setError("请输入深市主板六位股票代码");
      return;
    }
    if (!isDateRangeValid(start, end)) {
      setError("请选择有效且顺序正确的回测日期");
      return;
    }
    if (!Number.isInteger(breakoutLookback) || breakoutLookback < 5 || breakoutLookback > 120) {
      setError("突破周期必须在5至120之间");
      return;
    }

    setHasStarted(true);
    setIsLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams({ code: normalizedCode, start, end });
      const response = await fetch(`/api/backtest/history?${searchParams}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        success?: boolean;
        data?: BacktestHistoryResponse;
        error?: { message?: string };
      };
      if (
        !response.ok ||
        payload.success !== true ||
        !payload.data ||
        !Array.isArray(payload.data.bars)
      )
        throw new Error(payload.error?.message ?? "历史日线暂时不可用");
      setHistory(payload.data);
      setReport(
        runBacktest({
          bars: payload.data.bars,
          strategy,
          initialCapital: 100_000,
          breakoutLookback,
        }),
      );
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message ? caught.message : "回测暂时不可用，请稍后重试",
      );
    } finally {
      setIsLoading(false);
    }
  }, [breakoutLookback, code, end, start, strategy]);

  const state = resolveBacktestViewState({ hasStarted, isLoading, error, report });
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run();
  };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4">
      <section className="rounded-lg border border-cyan-400/20 bg-[#111318] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
              Backtest
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[#F4F7FB]">策略回测</h1>
            <p className="mt-2 text-sm text-[#8B95A7]">
              使用历史日线模拟执行，不产生真实订单或模拟交易记录。
            </p>
          </div>
          <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200">
            演示成本假设
          </span>
        </div>
        <form className="mt-5 grid gap-4 lg:grid-cols-12" onSubmit={onSubmit}>
          <label className="lg:col-span-2">
            <span className="text-xs text-[#8B95A7]">股票代码</span>
            <input
              className="mt-2 h-10 w-full rounded-md border border-[#252A33] bg-[#090A0D] px-3 font-mono text-sm text-[#F4F7FB] outline-none focus:border-cyan-300"
              maxLength={6}
              onChange={(event) => setCode(event.target.value)}
              value={code}
            />
          </label>
          <label className="lg:col-span-2">
            <span className="text-xs text-[#8B95A7]">开始日期</span>
            <input
              className="mt-2 h-10 w-full rounded-md border border-[#252A33] bg-[#090A0D] px-3 text-sm text-[#F4F7FB] outline-none focus:border-cyan-300"
              onChange={(event) => setStart(event.target.value)}
              type="date"
              value={start}
            />
          </label>
          <label className="lg:col-span-2">
            <span className="text-xs text-[#8B95A7]">结束日期</span>
            <input
              className="mt-2 h-10 w-full rounded-md border border-[#252A33] bg-[#090A0D] px-3 text-sm text-[#F4F7FB] outline-none focus:border-cyan-300"
              onChange={(event) => setEnd(event.target.value)}
              type="date"
              value={end}
            />
          </label>
          <div className="lg:col-span-4">
            <span className="text-xs text-[#8B95A7]">策略</span>
            <div className="mt-2 flex h-10 flex-wrap gap-2">
              {strategies.map((item) => (
                <button
                  className={`rounded-md border px-3 text-xs font-semibold ${strategy === item.id ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100" : "border-[#252A33] bg-[#090A0D] text-[#8B95A7]"}`}
                  key={item.id}
                  onClick={() => setStrategy(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {strategy === "breakout" ? (
            <label className="lg:col-span-1">
              <span className="text-xs text-[#8B95A7]">周期 N</span>
              <input
                className="mt-2 h-10 w-full rounded-md border border-[#252A33] bg-[#090A0D] px-3 font-mono text-sm text-[#F4F7FB] outline-none focus:border-cyan-300"
                max={120}
                min={5}
                onChange={(event) => setBreakoutLookback(Number(event.target.value))}
                type="number"
                value={breakoutLookback}
              />
            </label>
          ) : (
            <div className="hidden lg:col-span-1 lg:block" />
          )}
          <div className="flex items-end lg:col-span-1">
            <button
              className="h-10 w-full rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#071014] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? "计算中" : "运行回测"}
            </button>
          </div>
        </form>
        <p className="mt-4 text-xs leading-5 text-[#586174]">
          初始资金 100,000 元 · 100 股整手 · 双向滑点 0.05% · 双向佣金 0.03%（最低 5 元）·
          卖出附加费率 0.05%
        </p>
      </section>
      {state === "idle" ? (
        <section className="rounded-lg border border-dashed border-[#252A33] bg-[#111318] px-5 py-10 text-center text-sm text-[#8B95A7]">
          设置回测范围后运行策略
        </section>
      ) : null}
      {state === "error" ? (
        <section className="rounded-lg border border-rose-400/25 bg-rose-400/5 p-4">
          <p className="text-sm text-rose-200">{error}</p>
          <button
            className="mt-3 rounded-md border border-rose-300/30 px-3 py-1.5 text-xs font-semibold text-rose-100"
            onClick={() => void run()}
            type="button"
          >
            重试
          </button>
        </section>
      ) : null}
      {report ? (
        <>
          <BacktestSummary report={report} />
          {isLoading ? <BacktestLoading /> : null}
          {state === "empty" ? (
            <p className="rounded-lg border border-[#252A33] bg-[#111318] px-4 py-3 text-sm text-[#8B95A7]">
              本次回测未产生完成交易，报告仍保留资金与风险统计。
            </p>
          ) : null}
          <BacktestEquityChart points={report.equityCurve} />
          <BacktestTradeList trades={report.trades} />
          {history ? (
            <p className="text-xs text-[#586174]">
              数据来源 {history.source} · {history.returnedTradingDays} 个交易日 · 更新于{" "}
              {history.updatedAt}
            </p>
          ) : null}
        </>
      ) : null}
      {state === "loading" && !report ? <BacktestLoading /> : null}
    </div>
  );
}

function BacktestLoading() {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div
          className="h-24 animate-pulse rounded-lg border border-[#252A33] bg-[#111318]"
          key={index}
        />
      ))}
      <div className="col-span-2 h-64 animate-pulse rounded-lg border border-[#252A33] bg-[#111318] lg:col-span-4" />
    </section>
  );
}

function defaultDates(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function isDateRangeValid(start: string, end: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end;
}
