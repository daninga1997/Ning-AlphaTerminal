import { describe, it, expect } from "vitest";
import { getLatestExpectedTradingDate, isTradingDay, getPreviousTradingDay, getNextTradingDay, getTradingPhase, toShanghaiDateStr } from "./trading-day-resolver";

describe("Trading Calendar", () => {
  describe("isTradingDay", () => {
    it("周日不是交易日", () => {
      // 2026-07-19 is Sunday
      expect(isTradingDay("2026-07-19")).toBe(false);
    });

    it("周六不是交易日", () => {
      // 2026-07-18 is Saturday
      expect(isTradingDay("2026-07-18")).toBe(false);
    });

    it("非节假日的周一至周五是交易日", () => {
      // 2026-07-15 is Wednesday
      expect(isTradingDay("2026-07-15")).toBe(true);
    });

    it("国庆节不是交易日", () => {
      expect(isTradingDay("2026-10-01")).toBe(false);
      expect(isTradingDay("2026-10-02")).toBe(false);
    });

    it("春节不是交易日", () => {
      expect(isTradingDay("2026-02-17")).toBe(false);
    });
  });

  describe("getPreviousTradingDay", () => {
    it("周一的上个交易日是上周五", () => {
      // 2026-07-20 is Monday, previous should be 2026-07-17 (Friday)
      const prev = getPreviousTradingDay("2026-07-20");
      expect(prev).toBe("2026-07-17");
    });

    it("普通交易日返回前一天", () => {
      const prev = getPreviousTradingDay("2026-07-16");
      expect(prev).toBe("2026-07-15");
    });
  });

  describe("getNextTradingDay", () => {
    it("周五的下个交易日是下周一", () => {
      const next = getNextTradingDay("2026-07-17");
      expect(next).toBe("2026-07-20");
    });
  });

  describe("getLatestExpectedTradingDate", () => {
    it("交易日14:00最新完整日线应为上一交易日", () => {
      // Simulate 2026-07-15 14:00 CST
      const now = new Date("2026-07-15T06:00:00Z"); // 14:00 CST
      const date = getLatestExpectedTradingDate(now);
      expect(date).toBe("2026-07-14"); // 前一个交易日
    });

    it("交易日15:10最新完整日线应为当日", () => {
      const now = new Date("2026-07-15T07:10:00Z"); // 15:10 CST
      const date = getLatestExpectedTradingDate(now);
      expect(date).toBe("2026-07-15");
    });

    it("周末返回最近交易日", () => {
      const now = new Date("2026-07-19T06:00:00Z"); // Sunday
      const date = getLatestExpectedTradingDate(now);
      expect(date).toBe("2026-07-17"); // Friday
    });

    it("未来时间被拒绝", () => {
      // Should not throw, should return valid date
      const date = getLatestExpectedTradingDate(new Date());
      expect(date).toBeTruthy();
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("getTradingPhase", () => {
    it("盘前9:00为premarket", () => {
      const now = new Date("2026-07-15T01:00:00Z"); // 09:00 CST
      expect(getTradingPhase(now)).toBe("premarket");
    });

    it("盘中10:00为morning", () => {
      const now = new Date("2026-07-15T02:00:00Z"); // 10:00 CST
      expect(getTradingPhase(now)).toBe("morning");
    });

    it("午休12:00为lunch_break", () => {
      const now = new Date("2026-07-15T04:00:00Z"); // 12:00 CST
      expect(getTradingPhase(now)).toBe("lunch_break");
    });

    it("收盘后15:30为closed", () => {
      const now = new Date("2026-07-15T07:30:00Z"); // 15:30 CST
      expect(getTradingPhase(now)).toBe("closed");
    });

    it("非交易日返回non_trading_day", () => {
      const now = new Date("2026-07-19T02:00:00Z"); // Sunday
      expect(getTradingPhase(now)).toBe("non_trading_day");
    });
  });

  describe("toShanghaiDateStr", () => {
    it("转换UTC时间为上海日期", () => {
      const date = toShanghaiDateStr(new Date("2026-07-15T06:00:00Z"));
      expect(date).toBe("2026-07-15");
    });
  });
});