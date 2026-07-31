import type { DailyBar, IndicatorSnapshot } from "@/types/market";
import type { TradeLevels } from "@/types/scoring";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function latestClose(bars: DailyBar[]): number {
  return bars.at(-1)?.close ?? 0;
}

export function hasCalculatedTradeLevels(levels: TradeLevels): boolean {
  const values = [
    levels.firstEntryLow,
    levels.firstEntryHigh,
    levels.secondEntryLow,
    levels.secondEntryHigh,
    levels.chaseLimit,
    levels.stopLoss,
    levels.firstTarget,
    levels.secondTarget,
    levels.riskRewardRatio,
  ];

  return (
    values.every((value) => Number.isFinite(value) && value > 0) &&
    levels.secondEntryHigh < levels.firstEntryLow &&
    levels.stopLoss < levels.firstEntryLow &&
    levels.firstTarget > levels.firstEntryHigh &&
    levels.secondTarget > levels.firstTarget
  );
}

function unavailableTradeLevels(): TradeLevels {
  return {
    firstEntryLow: 0,
    firstEntryHigh: 0,
    secondEntryLow: 0,
    secondEntryHigh: 0,
    chaseLimit: 0,
    stopLoss: 0,
    firstTarget: 0,
    secondTarget: 0,
    riskRewardRatio: 0,
    invalidReason: "日线数据不足，无法计算交易计划",
  };
}

export function calculateTradeLevels(bars: DailyBar[], indicators: IndicatorSnapshot): TradeLevels {
  if (
    bars.length < 20 ||
    bars.some(
      (bar) =>
        ![bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite) ||
        bar.low <= 0 ||
        bar.high < Math.max(bar.open, bar.close, bar.low) ||
        bar.low > Math.min(bar.open, bar.close, bar.high),
    )
  ) {
    return unavailableTradeLevels();
  }

  const close = latestClose(bars);
  const atr = indicators.atr14 ?? Math.max(close * 0.03, 0.01);
  const ma10 = indicators.sma10 ?? close;
  const ma20 = indicators.sma20 ?? close;
  const high20 = indicators.high20 ?? close * 1.05;
  const low20 = indicators.low20 ?? close * 0.95;
  const recentLow = Math.min(...bars.slice(-20).map((bar) => bar.low));
  const platformSupport = Math.max(Math.min(ma10, ma20), low20);
  const firstSupport = Math.min(close, Math.max(ma10, ma20 * 0.995, platformSupport));
  const firstEntryLow = round2(firstSupport - atr * 0.25);
  const firstEntryHigh = round2(firstSupport + atr * 0.25);
  const secondSupport = Math.min(ma20, low20 + atr * 0.35, firstEntryLow - atr * 0.45);
  const secondEntryHigh = round2(Math.min(secondSupport + atr * 0.2, firstEntryLow - 0.01));
  const secondEntryLow = round2(Math.min(secondSupport - atr * 0.35, secondEntryHigh - 0.01));
  const chaseLimit = round2(Math.max(close, high20) + Math.min(atr * 0.6, close * 0.035));
  const stopLoss = round2(Math.min(recentLow - atr * 0.35, secondEntryLow - atr * 0.25));
  const plannedEntry = (firstEntryLow + firstEntryHigh) / 2;
  const risk = Math.max(plannedEntry - stopLoss, 0.01);
  const resistanceTarget = Math.max(high20 + atr * 0.35, close + atr * 0.8);
  const firstTarget = round2(Math.max(firstEntryHigh + 0.01, resistanceTarget));
  const secondTarget = round2(Math.max(firstTarget + atr, plannedEntry + risk * 2.2));
  const riskRewardRatio = round2((firstTarget - plannedEntry) / risk);
  const invalidReason = riskRewardRatio < 1.5 ? "当前盈亏比不足" : null;

  return {
    firstEntryLow,
    firstEntryHigh,
    secondEntryLow,
    secondEntryHigh,
    chaseLimit,
    stopLoss,
    firstTarget,
    secondTarget,
    riskRewardRatio,
    invalidReason,
  };
}
