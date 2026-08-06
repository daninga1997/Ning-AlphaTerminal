import { describe, expect, it } from "vitest";

import {
  getNextSellableTradingDay,
  type TradingDayCalendar,
} from "./t1-calendar";

describe("paper T+1 calendar port", () => {
  it("returns the next trading day supplied by the calendar", () => {
    const calendar: TradingDayCalendar = {
      nextTradingDay(afterTradingDate) {
        expect(afterTradingDate).toBe("2026-08-03");
        return "2026-08-04";
      },
    };

    expect(
      getNextSellableTradingDay({
        acquiredTradingDate: "2026-08-03",
        calendar,
      }),
    ).toBe("2026-08-04");
  });

  it("uses the injected calendar for a weekend or holiday transition", () => {
    const calendar: TradingDayCalendar = {
      nextTradingDay: () => "2026-08-10",
    };

    expect(
      getNextSellableTradingDay({
        acquiredTradingDate: "2026-08-07",
        calendar,
      }),
    ).toBe("2026-08-10");
  });

  it("rejects an unavailable next trading day", () => {
    expect(() =>
      getNextSellableTradingDay({
        acquiredTradingDate: "2026-08-03",
        calendar: { nextTradingDay: () => null },
      }),
    ).toThrow("NEXT_TRADING_DAY_UNAVAILABLE");
  });

  it.each([
    "",
    "2026-8-3",
    "03-08-2026",
    "2026/08/03",
    "not-a-date",
    "2026-02-30",
    "2026-13-01",
  ])("rejects an invalid acquired trading date: %s", (acquiredTradingDate) => {
    expect(() =>
      getNextSellableTradingDay({
        acquiredTradingDate,
        calendar: { nextTradingDay: () => "2026-08-04" },
      }),
    ).toThrow("TRADING_DATE_INVALID");
  });

  it.each(["", "2026-8-4", "not-a-date", "2026-02-30"])(
    "rejects an invalid calendar date: %s",
    (nextTradingDay) => {
      expect(() =>
        getNextSellableTradingDay({
          acquiredTradingDate: "2026-08-03",
          calendar: { nextTradingDay: () => nextTradingDay },
        }),
      ).toThrow("NEXT_TRADING_DAY_INVALID");
    },
  );

  it.each(["2026-08-03", "2026-07-31"])(
    "rejects a calendar date that is not later: %s",
    (nextTradingDay) => {
      expect(() =>
        getNextSellableTradingDay({
          acquiredTradingDate: "2026-08-03",
          calendar: { nextTradingDay: () => nextTradingDay },
        }),
      ).toThrow("NEXT_TRADING_DAY_INVALID");
    },
  );

  it("calls the calendar port exactly once", () => {
    let calls = 0;
    const calendar: TradingDayCalendar = {
      nextTradingDay: () => {
        calls += 1;
        return "2026-08-04";
      },
    };

    getNextSellableTradingDay({
      acquiredTradingDate: "2026-08-03",
      calendar,
    });

    expect(calls).toBe(1);
  });

  it("propagates calendar provider errors unchanged", () => {
    expect(() =>
      getNextSellableTradingDay({
        acquiredTradingDate: "2026-08-03",
        calendar: {
          nextTradingDay: () => {
            throw new Error("CALENDAR_PROVIDER_FAILED");
          },
        },
      }),
    ).toThrow("CALENDAR_PROVIDER_FAILED");
  });
});
