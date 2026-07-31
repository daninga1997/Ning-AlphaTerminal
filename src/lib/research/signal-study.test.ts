import { describe, expect, it } from "vitest";
import type { MarketDailyBar } from "@/types/market-data";
import { collectDailyCloseSignals, evaluateStrategyStudy, forwardReturn } from "./signal-study";

function bar(index: number, close: number, open = close, volume = 1_000_000): MarketDailyBar {
  return {
    code: "002472",
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    open,
    high: Math.max(open, close),
    low: Math.min(open, close),
    close,
    previousClose: close,
    volume,
    amount: close * volume,
    turnoverRate: 0,
    source: "tencent",
    isDemo: false,
  };
}

// 构造：index 23 启动（+10%），index 25 首阴，index 26 修复确认，之后正常上涨
function makeLeaderBars(): MarketDailyBar[] {
  const bars: MarketDailyBar[] = [];
  for (let index = 0; index < 30; index += 1) {
    if (index === 23) {
      bars.push(bar(index, 11, 10.5, 2_000_000));
      bars[index] = { ...bars[index]!, high: 11.2, low: 10.4 };
    } else if (index === 24) {
      bars.push(bar(index, 11.2, 11.1));
      bars[index] = { ...bars[index]!, high: 11.4, low: 11 };
    } else if (index === 25) {
      bars.push(bar(index, 10.67, 11.1, 1_200_000));
      bars[index] = { ...bars[index]!, high: 11.2, low: 10.6 };
    } else if (index === 26) {
      bars.push(bar(index, 11, 10.7));
      bars[index] = { ...bars[index]!, high: 11.1, low: 10.6 };
    } else {
      bars.push(bar(index, index >= 23 ? 11 + (index - 23) * 0.05 : 10));
    }
  }
  return bars;
}

describe("signal study", () => {
  it("collects a leader-first-yin close signal on the repair day", () => {
    const bars = makeLeaderBars();
    const hits = collectDailyCloseSignals("002472", bars, "leader_first_yin");
    expect(hits.map((hit) => hit.index)).toContain(26);
  });

  it("computes forward return from next-day open to the horizon close", () => {
    const bars = makeLeaderBars();
    const hit = { code: "002472", index: 26, date: bars[26]!.date, reason: null };
    // index 27 open = 11.2，持有 1 日卖 index 27 收盘 = 11.2
    expect(forwardReturn(bars, hit, 1)).toBeCloseTo(0);
  });

  it("evaluates strategy study with baseline comparison", () => {
    const bars = makeLeaderBars();
    const stats = evaluateStrategyStudy("002472", bars, "leader_first_yin", [3]);
    expect(stats[0]).toMatchObject({
      horizon: 3,
      signalCount: 1,
    });
    expect(stats[0]!.baselineMeanPercent).toBeGreaterThanOrEqual(-10);
  });
});
