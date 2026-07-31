import { describe, expect, it } from "vitest";
import { selectTradingDayMinuteBars } from "./current-minute-bars";

describe("selectTradingDayMinuteBars", () => {
  it("只保留当前交易日的分钟线快照", () => {
    const bars = [
      { timestamp: "2026-07-27T14:59:00+08:00" },
      { timestamp: "2026-07-29T09:30:00+08:00" },
      { timestamp: "2026-07-29T09:31:00+08:00" },
    ];

    expect(selectTradingDayMinuteBars(bars, "2026-07-29").map((bar) => bar.timestamp)).toEqual([
      "2026-07-29T09:30:00+08:00",
      "2026-07-29T09:31:00+08:00",
    ]);
  });
});
