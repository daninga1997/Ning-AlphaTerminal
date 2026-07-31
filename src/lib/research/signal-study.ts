import type { MarketDailyBar } from "../../types/market-data";
import { isFirstYinRepairConfirmingToday } from "../../server/strategy-engine/factors/leader-factors";
import { evaluateBacktestSignal } from "../backtest/backtest-strategies";

export type SignalKind = "leader_first_yin" | "late_session_daily" | "trend_swing_compatible";

export const STUDY_HORIZONS = [1, 3, 5, 10] as const;
export type StudyHorizon = (typeof STUDY_HORIZONS)[number];

export interface SignalHit {
  code: string;
  index: number;
  date: string;
  reason: string | null;
}

export interface ReturnStat {
  horizon: number;
  signalCount: number;
  meanReturnPercent: number;
  winRatePercent: number;
  baselineMeanPercent: number;
  baselineWinRatePercent: number;
  excessPercent: number;
}

// 收盘后确认信号：逐日扫描历史日线，命中生产策略的“当日收盘确认”信号
export function collectDailyCloseSignals(code: string, bars: MarketDailyBar[], strategy: SignalKind): SignalHit[] {
  const hits: SignalHit[] = [];
  for (let index = 20; index < bars.length; index += 1) {
    const signal =
      strategy === "leader_first_yin"
        ? leaderFirstYinEntry(bars, index)
        : evaluateBacktestSignal({ strategy, bars, index, breakoutLookback: 20 });
    if (signal.entry) {
      hits.push({ code, index, date: bars[index]!.date, reason: signal.reason });
    }
  }
  return hits;
}

function leaderFirstYinEntry(bars: MarketDailyBar[], index: number): { entry: boolean; exit: boolean; reason: string | null } {
  if (isFirstYinRepairConfirmingToday(bars, index)) {
    return { entry: true, exit: false, reason: "龙头首阴修复确认" };
  }
  return { entry: false, exit: false, reason: null };
}

// 信号日次日开盘买入，持有 horizon 个交易日，第 horizon 日收盘卖出
export function forwardReturn(bars: MarketDailyBar[], hit: SignalHit, horizon: number): number | null {
  const entry = bars[hit.index + 1];
  const exit = bars[hit.index + horizon];
  if (!entry || !exit || entry.open <= 0) return null;
  return ((exit.close - entry.open) / entry.open) * 100;
}

// 全样本基准：每个交易日“次日开盘买入、持有 horizon 日”
export function baselineForwardReturn(bars: MarketDailyBar[], index: number, horizon: number): number | null {
  const entry = bars[index + 1];
  const exit = bars[index + horizon];
  if (!entry || !exit || entry.open <= 0) return null;
  return ((exit.close - entry.open) / entry.open) * 100;
}

export function evaluateStrategyStudy(
  code: string,
  bars: MarketDailyBar[],
  strategy: SignalKind,
  horizons: readonly StudyHorizon[] = STUDY_HORIZONS,
): ReturnStat[] {
  const hits = collectDailyCloseSignals(code, bars, strategy);
  return horizons.map((horizon) => {
    const signalReturns: number[] = [];
    for (const hit of hits) {
      const value = forwardReturn(bars, hit, horizon);
      if (value !== null) signalReturns.push(value);
    }
    const baselineReturns: number[] = [];
    for (let index = 20; index + horizon < bars.length; index += 1) {
      const value = baselineForwardReturn(bars, index, horizon);
      if (value !== null) baselineReturns.push(value);
    }
    const signal = summarize(signalReturns);
    const baseline = summarize(baselineReturns);
    return {
      horizon,
      signalCount: signalReturns.length,
      meanReturnPercent: signal.mean,
      winRatePercent: signal.winRate,
      baselineMeanPercent: baseline.mean,
      baselineWinRatePercent: baseline.winRate,
      excessPercent: round2(signal.mean - baseline.mean),
    };
  });
}

// 多股票结果按信号数加权合并
export function mergeStudyResults(perCode: ReturnStat[][]): ReturnStat[] {
  const horizonCount = Math.max(0, ...perCode.map((stats) => stats.length));
  return Array.from({ length: horizonCount }, (_, horizonIndex) => {
    const rows = perCode.map((stats) => stats[horizonIndex]).filter((row): row is ReturnStat => Boolean(row));
    if (rows.length === 0) {
      return {
        horizon: horizonIndex + 1,
        signalCount: 0,
        meanReturnPercent: 0,
        winRatePercent: 0,
        baselineMeanPercent: 0,
        baselineWinRatePercent: 0,
        excessPercent: 0,
      };
    }
    const totalSignals = rows.reduce((sum, row) => sum + row.signalCount, 0);
    const meanReturn = rows.reduce((sum, row) => sum + row.meanReturnPercent * row.signalCount, 0) / Math.max(1, totalSignals);
    const winRate = rows.reduce((sum, row) => sum + row.winRatePercent * row.signalCount, 0) / Math.max(1, totalSignals);
    const baselineMean = rows.reduce((sum, row) => sum + row.baselineMeanPercent * row.signalCount, 0) / Math.max(1, totalSignals);
    const baselineWinRate = rows.reduce((sum, row) => sum + row.baselineWinRatePercent * row.signalCount, 0) / Math.max(1, totalSignals);
    return {
      horizon: rows[0]!.horizon,
      signalCount: totalSignals,
      meanReturnPercent: round2(meanReturn),
      winRatePercent: round2(winRate),
      baselineMeanPercent: round2(baselineMean),
      baselineWinRatePercent: round2(baselineWinRate),
      excessPercent: round2(meanReturn - baselineMean),
    };
  });
}

function summarize(values: number[]): { mean: number; winRate: number } {
  if (values.length === 0) return { mean: 0, winRate: 0 };
  return {
    mean: round2(values.reduce((sum, value) => sum + value, 0) / values.length),
    winRate: round2((values.filter((value) => value > 0).length / values.length) * 100),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
