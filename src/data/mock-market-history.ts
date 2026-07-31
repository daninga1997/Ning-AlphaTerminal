import { getMockStockForCode, mockStocks } from "./mock-stocks";
import type { DailyBar } from "../types/market";

export const HISTORY_LENGTH = 260;

const baseDate = new Date(Date.UTC(2026, 0, 2));

// 龙头首阴修复形态：最后三根 K 线为 涨停启动 → 缩量首阴 → 修复阳线
const FIRST_YIN_CODES = new Set(["002317", "002653", "002472"]);
// 中期上升趋势：整体抬升，满足 MA20>MA60 与回撤可控
const TREND_RAMP_CODES = new Set(["000063", "002463", "002625", "002896"]);
// 上升趋势后回踩均线区，贴近关注区，用于演示波段试仓
const PULLBACK_CODES = new Set(["000988"]);

function formatDate(offset: number): string {
  const date = new Date(baseDate);
  date.setUTCDate(baseDate.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function codeSeed(code: string): number {
  return code.split("").reduce((sum, char) => sum + Number(char), 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function makeBar(code: string, index: number, open: number, close: number, volume: number): DailyBar {
  const high = Math.max(open, close) * 1.01;
  const low = Math.min(open, close) * 0.99;
  return {
    date: formatDate(index),
    open: round2(open),
    high: round2(Math.max(high, open, close, low)),
    low: round2(Math.min(low, open, close, high)),
    close: round2(close),
    volume: Math.round(volume),
    turnover: round2((volume * close) / 100000000),
  };
}

function makeBaseSeries(code: string, latestPrice: number, changePercent: number): DailyBar[] {
  const seed = codeSeed(code);
  const bars: DailyBar[] = [];
  const drift = ((seed % 7) - 2) * 0.0009;
  const amplitude = 0.012 + (seed % 5) * 0.002;
  const startPrice = Math.max(3, latestPrice * (0.72 + (seed % 6) * 0.035));
  let close = startPrice;

  for (let index = 0; index < HISTORY_LENGTH; index += 1) {
    const wave = Math.sin((index + seed) / 6) * amplitude;
    const pulse = Math.cos((index + seed) / 13) * 0.006;
    const step = drift + wave + pulse;
    const open = close * (1 + Math.sin((index + seed) / 9) * 0.004);
    close = Math.max(2, close * (1 + step));

    if (index === HISTORY_LENGTH - 2) {
      close = latestPrice / (1 + changePercent / 100);
    }
    if (index === HISTORY_LENGTH - 1) {
      close = latestPrice;
    }

    const volume = 800000 + seed * 15000 + index * 4200 + Math.abs(Math.sin(index / 5)) * 260000;
    bars.push(makeBar(code, index, open, close, volume));
  }

  return bars;
}

// 最后四根 K 线：启动前收盘 → +10% 启动 → -3.5% 缩量首阴（≤1.3 倍启动量）→ 修复阳线
function injectFirstYinRepair(code: string, bars: DailyBar[], latestPrice: number, changePercent: number): void {
  const seed = codeSeed(code);
  const last = bars.length - 1;
  const repairClose = latestPrice;
  const firstYinClose = latestPrice / (1 + changePercent / 100);
  const launchClose = firstYinClose / (1 - 0.035);
  const preLaunchClose = launchClose / 1.1;
  const launchVolume = 2_400_000 + seed * 10_000;

  bars[last - 3] = makeBar(code, last - 3, preLaunchClose * 0.99, preLaunchClose, launchVolume * 0.8);
  bars[last - 2] = makeBar(code, last - 2, preLaunchClose * 1.02, launchClose, launchVolume);
  bars[last - 1] = makeBar(code, last - 1, launchClose * 1.005, firstYinClose, launchVolume * 1.2);
  bars[last] = makeBar(code, last, firstYinClose * 1.005, repairClose, launchVolume);
}

// 整体上升趋势：0.80×最新价 → 最新价，小幅波动，回撤可控
function makeRisingSeries(code: string, latestPrice: number, changePercent: number): DailyBar[] {
  const seed = codeSeed(code);
  const bars: DailyBar[] = [];
  const end = HISTORY_LENGTH - 1;

  for (let index = 0; index < HISTORY_LENGTH; index += 1) {
    const t = index / end;
    const target = latestPrice * (0.8 + t * 0.2);
    const wobble = Math.sin((index + seed) / 7) * target * 0.008;
    const open = target * (1 + Math.cos((index + seed) / 9) * 0.004);
    const close = index === HISTORY_LENGTH - 2 ? latestPrice / (1 + changePercent / 100) : target + wobble;
    const volume = 900_000 + seed * 12_000 + index * 3_500;
    bars.push(makeBar(code, index, open, index === HISTORY_LENGTH - 1 ? latestPrice : close, volume));
  }

  return bars;
}

// 上升趋势后最后 12 根 K 线温和回踩至均线簇附近
function applyPullbackToZone(code: string, bars: DailyBar[], latestPrice: number): void {
  const seed = codeSeed(code);
  const last = bars.length - 1;
  const pullStart = last - 11;
  const startClose = bars[pullStart - 1].close;

  for (let index = pullStart; index <= last; index += 1) {
    const t = (index - pullStart) / (last - pullStart);
    const target = startClose * (1 - t * 0.015);
    const open = target * (1 + Math.sin((index + seed) / 5) * 0.004);
    const close = index === last ? latestPrice : target;
    bars[index] = makeBar(code, index, open, close, 900_000 + seed * 12_000 + index * 3_500);
  }
}

function makeDailyHistory(code: string, latestPrice: number, changePercent: number): DailyBar[] {
  const bars = FIRST_YIN_CODES.has(code) || TREND_RAMP_CODES.has(code) || PULLBACK_CODES.has(code)
    ? makeRisingSeries(code, latestPrice, changePercent)
    : makeBaseSeries(code, latestPrice, changePercent);

  if (FIRST_YIN_CODES.has(code)) {
    injectFirstYinRepair(code, bars, latestPrice, changePercent);
  }
  if (PULLBACK_CODES.has(code)) {
    applyPullbackToZone(code, bars, latestPrice);
  }

  return bars;
}

export const mockMarketHistory: Record<string, DailyBar[]> = Object.fromEntries(
  mockStocks.map((stock) => [
    stock.code,
    makeDailyHistory(stock.code, stock.currentPrice, stock.changePercent),
  ]),
);

const syntheticHistoryCache = new Map<string, DailyBar[]>();

// 观察池之外的代码：按确定性画像生成 260 根模拟日线，并缓存
export function getMockMarketHistory(code: string): DailyBar[] {
  const existing = mockMarketHistory[code];
  if (existing) return existing;

  const cached = syntheticHistoryCache.get(code);
  if (cached) return cached;

  const profile = getMockStockForCode(code);
  const bars = makeBaseSeries(code, profile.currentPrice, profile.changePercent);
  syntheticHistoryCache.set(code, bars);
  return bars;
}
