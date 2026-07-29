import { trendSwingConfig } from "../../server/strategy-engine/config/trend-swing-config";
import { movingAverages } from "../../server/strategy-engine/factors/trend-factors";
import type { BacktestSignal, BacktestSignalInput } from "@/types/backtest";
import { averageVolume, calculateEma, previousHighestHigh, previousLowestLow } from "./backtest-indicators";

const noSignal = (reason: string | null = null): BacktestSignal => ({ entry: false, exit: false, reason });

export function evaluateBacktestSignal(input: BacktestSignalInput): BacktestSignal {
  if (input.strategy === "breakout") return evaluateBreakoutSignal(input);
  if (input.strategy === "ema_cross") return evaluateEmaCrossSignal(input);
  return evaluateTrendSwingCompatibleSignal(input);
}

function evaluateBreakoutSignal({ bars, index, breakoutLookback }: BacktestSignalInput): BacktestSignal {
  const current = bars[index];
  const priorHigh = previousHighestHigh(bars, index, breakoutLookback);
  const exitLookback = Math.floor(breakoutLookback / 2);
  const priorLow = previousLowestLow(bars, index, exitLookback);

  if (!current || priorHigh === null || priorLow === null || !Number.isFinite(current.close)) {
    return noSignal(`历史数据不足：突破策略需要${breakoutLookback + 1}个交易日`);
  }
  if (current.close > priorHigh) return { entry: true, exit: false, reason: `突破此前${breakoutLookback}日高点` };
  if (current.close < priorLow) return { entry: false, exit: true, reason: `跌破此前${exitLookback}日低点` };
  return noSignal("未触发突破或退出条件");
}

function evaluateEmaCrossSignal({ bars, index }: BacktestSignalInput): BacktestSignal {
  const currentBars = bars.slice(0, index + 1);
  const previousBars = bars.slice(0, index);
  const currentFast = calculateEma(currentBars.map((bar) => bar.close), 12);
  const currentSlow = calculateEma(currentBars.map((bar) => bar.close), 26);
  const previousFast = calculateEma(previousBars.map((bar) => bar.close), 12);
  const previousSlow = calculateEma(previousBars.map((bar) => bar.close), 26);

  if ([currentFast, currentSlow, previousFast, previousSlow].some((value) => value === null)) {
    return noSignal("历史数据不足：EMA交叉策略需要27个交易日");
  }
  if (previousFast! <= previousSlow! && currentFast! > currentSlow!) return { entry: true, exit: false, reason: "EMA12上穿EMA26" };
  if (previousFast! >= previousSlow! && currentFast! < currentSlow!) return { entry: false, exit: true, reason: "EMA12下穿EMA26" };
  return noSignal("未触发EMA交叉条件");
}

function evaluateTrendSwingCompatibleSignal({ bars, index }: BacktestSignalInput): BacktestSignal {
  const currentBars = bars.slice(0, index + 1);
  if (currentBars.length < trendSwingConfig.minDailyBars) {
    return noSignal(`历史数据不足：趋势波段策略需要${trendSwingConfig.minDailyBars}个交易日`);
  }

  const latest = currentBars.at(-1)!;
  const ma = movingAverages(currentBars);
  const maFiveDaysAgo = movingAverages(currentBars.slice(0, -5)).ma20;
  const closeTwentyDaysAgo = currentBars.at(-21)?.close;
  const volumeAverage = averageVolume(currentBars, currentBars.length - 1, 20);

  if (
    ma.ma20 === null ||
    ma.ma60 === null ||
    maFiveDaysAgo === null ||
    closeTwentyDaysAgo === undefined ||
    closeTwentyDaysAgo <= 0 ||
    volumeAverage === null
  ) {
    return noSignal("趋势波段指标数据不足");
  }

  if (latest.close < ma.ma20 || ma.ma20 <= ma.ma60) {
    return { entry: false, exit: true, reason: latest.close < ma.ma20 ? "收盘跌破MA20" : "MA20不再高于MA60" };
  }

  const momentumPositive = latest.close > closeTwentyDaysAgo;
  const volumeConfirmed = latest.volume >= volumeAverage;
  const maRising = ma.ma20 > maFiveDaysAgo;
  if (maRising && momentumPositive && volumeConfirmed) {
    return { entry: true, exit: false, reason: "趋势波段条件确认" };
  }
  return noSignal("趋势波段入场条件未全部满足");
}
