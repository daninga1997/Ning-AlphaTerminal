import { trendSwingConfig } from "../../server/strategy-engine/config/trend-swing-config";
import { movingAverages } from "../../server/strategy-engine/factors/trend-factors";
import { isFirstYinRepairConfirmingToday } from "../../server/strategy-engine/factors/leader-factors";
import type { BacktestSignal, BacktestSignalInput } from "@/types/backtest";
import { averageVolume, calculateEma, previousHighestHigh, previousLowestLow } from "./backtest-indicators";

const noSignal = (reason: string | null = null): BacktestSignal => ({ entry: false, exit: false, reason });

export function evaluateBacktestSignal(input: BacktestSignalInput): BacktestSignal {
  if (input.strategy === "breakout") return evaluateBreakoutSignal(input);
  if (input.strategy === "ema_cross") return evaluateEmaCrossSignal(input);
  if (input.strategy === "trend_swing_compatible") return evaluateTrendSwingCompatibleSignal(input);
  if (input.strategy === "leader_first_yin") return evaluateLeaderFirstYinSignal(input);
  return evaluateLateSessionDailySignal(input);
}

// 龙头首阴修复（生产策略信号，日线可还原）：修复确认日入场，跌破前日低点退出
function evaluateLeaderFirstYinSignal({ bars, index }: BacktestSignalInput): BacktestSignal {
  if (isFirstYinRepairConfirmingToday(bars, index)) {
    return { entry: true, exit: false, reason: "龙头首阴修复确认（日线信号）" };
  }
  const current = bars[index];
  const previous = bars[index - 1];
  if (current && previous && current.close < previous.low) {
    return { entry: false, exit: true, reason: "跌破前日低点，首阴修复失效" };
  }
  return noSignal("未出现首阴修复结构");
}

// 尾盘趋势（生产策略的日线近似）：当日涨幅 2.5%-6% + 量能放大即入场，
// 持仓中条件失效则次日退出（T+1 由“次日开盘成交”模型保证）。
// 历史日线接口暂不提供换手率，因此未使用 5%-15% 换手区间。
function evaluateLateSessionDailySignal({ bars, index }: BacktestSignalInput): BacktestSignal {
  if (index < 20) return noSignal("历史数据不足：需要20日均量");
  const current = bars[index];
  const previous = bars[index - 1];
  if (!current || !previous || previous.close <= 0) return noSignal(null);
  const changePercent = ((current.close - previous.close) / previous.close) * 100;
  const avgVol20 = averageVolume(bars, index, 20);
  const volumeOk = avgVol20 !== null && avgVol20 > 0 && current.volume >= avgVol20 * 1.1;
  if (changePercent >= 2.5 && changePercent <= 6 && volumeOk) {
    return { entry: true, exit: false, reason: "尾盘趋势日线近似确认（涨幅2.5%-6%+量能放大）" };
  }
  return { entry: false, exit: true, reason: "尾盘条件失效，次日退出" };
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
