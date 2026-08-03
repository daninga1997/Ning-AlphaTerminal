import { describe, expect, it } from "vitest";

import {
  calculateTradeFees,
  DEFAULT_PAPER_FEE_SCHEDULE,
} from "./fee-calculator";

const fen = (value: string): bigint => BigInt(value);

describe("paper trade fee calculator", () => {
  it("exposes the default paper fee schedule", () => {
    expect(DEFAULT_PAPER_FEE_SCHEDULE).toEqual({
      commissionRatePpm: 250,
      minimumCommissionFen: fen("500"),
      stampDutySellRatePpm: 500,
      transferFeeRatePpm: 10,
    });
  });

  it("charges the five-yuan minimum commission for a small buy", () => {
    expect(
      calculateTradeFees({
        side: "buy",
        quantity: 100,
        priceFen: fen("1000"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }).commissionFen,
    ).toBe(fen("500"));
  });

  it("charges proportional commission when it exceeds the minimum", () => {
    expect(
      calculateTradeFees({
        side: "buy",
        quantity: 10_000,
        priceFen: fen("1000"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }).commissionFen,
    ).toBe(fen("2500"));
  });

  it("does not charge stamp duty for a buy", () => {
    expect(
      calculateTradeFees({
        side: "buy",
        quantity: 1_000,
        priceFen: fen("1000"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }).stampDutyFen,
    ).toBe(fen("0"));
  });

  it("charges 0.05 percent stamp duty for a sell", () => {
    expect(
      calculateTradeFees({
        side: "sell",
        quantity: 1_000,
        priceFen: fen("1000"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }).stampDutyFen,
    ).toBe(fen("500"));
  });

  it("charges transfer fees on both buys and sells", () => {
    const buy = calculateTradeFees({
      side: "buy",
      quantity: 1_000,
      priceFen: fen("1000"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
    });
    const sell = calculateTradeFees({
      side: "sell",
      quantity: 1_000,
      priceFen: fen("1000"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
    });

    expect(buy.transferFeeFen).toBe(fen("10"));
    expect(sell.transferFeeFen).toBe(fen("10"));
  });

  it("returns a complete fee breakdown with a consistent total", () => {
    const result = calculateTradeFees({
      side: "sell",
      quantity: 1_000,
      priceFen: fen("1000"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
    });

    expect(result).toEqual({
      notionalFen: fen("1000000"),
      commissionFen: fen("500"),
      stampDutyFen: fen("500"),
      transferFeeFen: fen("10"),
      totalFeeFen: fen("1010"),
    });
    expect(result.totalFeeFen).toBe(
      result.commissionFen + result.stampDutyFen + result.transferFeeFen,
    );
  });

  it("rounds a half-fen transfer fee upward", () => {
    expect(
      calculateTradeFees({
        side: "buy",
        quantity: 500,
        priceFen: fen("1000"),
        schedule: {
          ...DEFAULT_PAPER_FEE_SCHEDULE,
          transferFeeRatePpm: 1,
        },
      }).transferFeeFen,
    ).toBe(fen("1"));
  });

  it.each([
    ["zero", 0],
    ["a negative quantity", -1],
    ["a fractional quantity", 1.5],
    ["NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["an unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ])("rejects %s as a trade quantity", (_description, quantity) => {
    expect(() =>
      calculateTradeFees({
        side: "buy",
        quantity,
        priceFen: fen("1000"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }),
    ).toThrow("TRADE_QUANTITY_INVALID");
  });

  it.each([
    ["zero", fen("0")],
    ["a negative price", fen("-1")],
  ])("rejects %s as a trade price", (_description, priceFen) => {
    expect(() =>
      calculateTradeFees({
        side: "buy",
        quantity: 100,
        priceFen,
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }),
    ).toThrow("TRADE_PRICE_INVALID");
  });

  it("rejects an invalid trade side", () => {
    expect(() =>
      calculateTradeFees({
        side: "hold" as never,
        quantity: 100,
        priceFen: fen("1000"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }),
    ).toThrow("TRADE_SIDE_INVALID");
  });

  it.each([
    ["commissionRatePpm", "COMMISSION_RATE_INVALID"],
    ["stampDutySellRatePpm", "STAMP_DUTY_RATE_INVALID"],
    ["transferFeeRatePpm", "TRANSFER_FEE_RATE_INVALID"],
  ] as const)("rejects invalid %s values", (field, errorCode) => {
    for (const invalidValue of [
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(() =>
        calculateTradeFees({
          side: "buy",
          quantity: 100,
          priceFen: fen("1000"),
          schedule: {
            ...DEFAULT_PAPER_FEE_SCHEDULE,
            [field]: invalidValue,
          },
        }),
      ).toThrow(errorCode);
    }
  });

  it("rejects a negative minimum commission", () => {
    expect(() =>
      calculateTradeFees({
        side: "buy",
        quantity: 100,
        priceFen: fen("1000"),
        schedule: {
          ...DEFAULT_PAPER_FEE_SCHEDULE,
          minimumCommissionFen: fen("-1"),
        },
      }),
    ).toThrow("MINIMUM_COMMISSION_INVALID");
  });

  it("rejects a notional amount above the SQLite Int64 maximum", () => {
    expect(() =>
      calculateTradeFees({
        side: "buy",
        quantity: Number.MAX_SAFE_INTEGER,
        priceFen: fen("10000"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }),
    ).toThrow("PAPER_ACCOUNT_BIGINT_OUT_OF_RANGE");
  });

  it("returns bigint for every monetary field", () => {
    const result = calculateTradeFees({
      side: "buy",
      quantity: 100,
      priceFen: fen("1000"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
    });

    expect(typeof result.notionalFen).toBe("bigint");
    expect(typeof result.commissionFen).toBe("bigint");
    expect(typeof result.stampDutyFen).toBe("bigint");
    expect(typeof result.transferFeeFen).toBe("bigint");
    expect(typeof result.totalFeeFen).toBe("bigint");
  });
});
