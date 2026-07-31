import type { MarketDailyBar } from "@/types/market-data";
import { leaderFirstYinConfig } from "../config/leader-first-yin-config";
import { percentChange } from "../scoring/score-utils";

export function findRecentLaunchIndex(bars: MarketDailyBar[], lookback = 20): number {
  const start = Math.max(1, bars.length - lookback);
  for (let index = bars.length - 1; index >= start; index -= 1) {
    const previous = bars[index - 1];
    const current = bars[index];
    if (previous && current && percentChange(current.close, previous.close) >= leaderFirstYinConfig.minLaunchGainPercent) {
      return index;
    }
  }
  return -1;
}

export interface FirstYinRepairOptions {
  launchLookback?: number;
  maxDaysAfterLaunch?: number;
  maxRepairDaysAfterYin?: number;
}

export interface FirstYinRepairResult {
  launchIndex: number;
  firstYinIndex: number;
  repairIndex: number;
}

// 在 [0..upToIndex] 范围内查找最近一次“修复已确认”的首阴结构（修复日 == upToIndex）。
// 首阴允许出现在启动后 maxDaysAfterLaunch 天内，修复允许出现在首阴后 maxRepairDaysAfterYin 天内，
// 解决原实现只认“启动+1 首阴、+2 修复”的刚性窗口问题。
export function findFirstYinRepairUpTo(
  bars: MarketDailyBar[],
  upToIndex: number,
  options: FirstYinRepairOptions = {},
): FirstYinRepairResult | null {
  if (upToIndex < 1) return null;
  const launchLookback = options.launchLookback ?? 20;
  const maxDaysAfterLaunch = options.maxDaysAfterLaunch ?? leaderFirstYinConfig.maxDaysAfterLaunch;
  const maxRepairDaysAfterYin = options.maxRepairDaysAfterYin ?? 2;
  const launchFloor = Math.max(1, upToIndex - launchLookback);

  for (let yin = upToIndex - 1; yin >= upToIndex - maxRepairDaysAfterYin && yin > 0; yin -= 1) {
    const yinLaunchFloor = Math.max(launchFloor, yin - maxDaysAfterLaunch);
    for (let launch = yin - 1; launch >= yinLaunchFloor; launch -= 1) {
      if (!isLaunchDay(bars, launch)) continue;
      if (isValidFirstYin(bars, launch, yin) && isRepairConfirmed(bars, yin, upToIndex)) {
        return { launchIndex: launch, firstYinIndex: yin, repairIndex: upToIndex };
      }
    }
  }
  return null;
}

export function hasFirstYinRepairStructure(bars: MarketDailyBar[]): boolean {
  const result = findFirstYinRepairUpTo(bars, bars.length - 1);
  return result !== null && result.repairIndex === bars.length - 1;
}

// 信号只在“修复首次确认日”触发一次，避免结构形成后每个上涨日重复确认造成重复信号
export function isFirstYinRepairConfirmingToday(bars: MarketDailyBar[], index: number): boolean {
  if (findFirstYinRepairUpTo(bars, index)?.repairIndex !== index) return false;
  return findFirstYinRepairUpTo(bars, index - 1)?.repairIndex !== index - 1;
}

function isLaunchDay(bars: MarketDailyBar[], index: number): boolean {
  const previous = bars[index - 1];
  const current = bars[index];
  return Boolean(previous && current) && percentChange(current!.close, previous!.close) >= leaderFirstYinConfig.minLaunchGainPercent;
}

function isValidFirstYin(bars: MarketDailyBar[], launchIndex: number, yinIndex: number): boolean {
  const launch = bars[launchIndex];
  const yin = bars[yinIndex];
  if (!launch || !yin) return false;
  const change = percentChange(yin.close, launch.close);
  return (
    change >= leaderFirstYinConfig.firstYinMinChangePercent &&
    change <= leaderFirstYinConfig.firstYinMaxChangePercent &&
    change > leaderFirstYinConfig.nearLimitDownPercent &&
    yin.volume <= launch.volume * leaderFirstYinConfig.maxFirstYinVolumeToLaunch &&
    yin.close >= Math.min(launch.open, launch.close) * 0.98
  );
}

function isRepairConfirmed(bars: MarketDailyBar[], yinIndex: number, repairIndex: number): boolean {
  const yin = bars[yinIndex];
  const repair = bars[repairIndex];
  return Boolean(yin && repair) && (repair!.close > yin!.close || repair!.high > yin!.high);
}
