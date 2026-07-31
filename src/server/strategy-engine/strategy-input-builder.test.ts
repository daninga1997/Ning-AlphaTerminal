import { describe, expect, it } from "vitest";
import { selectCompletedDailyBars } from "./completed-daily-bars";

describe("selectCompletedDailyBars", () => {
  it("排除盘中尚未收盘的当日日线", () => {
    const bars = [
      { code: "002472", date: "2026-07-28", open: 10, high: 11, low: 9, close: 10, previousClose: 10, volume: 1, amount: 10, turnoverRate: 0, source: "tencent", isDemo: false },
      { code: "002472", date: "2026-07-29", open: 10, high: 11, low: 9, close: 10, previousClose: 10, volume: 1, amount: 10, turnoverRate: 0, source: "tencent", isDemo: false },
    ];

    expect(selectCompletedDailyBars(bars, "2026-07-28").map((bar) => bar.date)).toEqual(["2026-07-28"]);
  });
});
