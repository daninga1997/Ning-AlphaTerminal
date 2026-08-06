import { describe, expect, it } from "vitest";

import {
  calculateTradeFees,
  DEFAULT_PAPER_FEE_SCHEDULE,
} from "./fee-calculator";
import { calculateBreakEvenStop } from "./break-even-stop";

const fen = (value: string): bigint => BigInt(value);
const sqliteInt64Max = fen("9223372036854775807");

function netSellProceeds(
  quantity: number,
  priceFen: bigint,
  schedule = DEFAULT_PAPER_FEE_SCHEDULE,
): bigint {
  const fees = calculateTradeFees({
    side: "sell",
    quantity,
    priceFen,
    schedule,
  });

  return fees.notionalFen - fees.totalFeeFen;
}

describe("paper break-even stop", () => {
  it("finds the minimum inclusive-fee break-even price after the first target", () => {
    const firstTargetNetProceeds = netSellProceeds(100, fen("1200"));
    const unrecoveredCostFen = fen("200500") - firstTargetNetProceeds;
    const result = calculateBreakEvenStop({
      remainingQuantity: 100,
      unrecoveredCostFen,
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
    });

    expect(firstTargetNetProceeds).toBe(fen("119439"));
    expect(unrecoveredCostFen).toBe(fen("81061"));
    expect(result).toBe(fen("817"));
    expect(netSellProceeds(100, result)).toBeGreaterThanOrEqual(
      unrecoveredCostFen,
    );
    expect(netSellProceeds(100, result - fen("1"))).toBeLessThan(
      unrecoveredCostFen,
    );
  });

  it("includes the five-yuan minimum commission in the break-even price", () => {
    const result = calculateBreakEvenStop({
      remainingQuantity: 100,
      unrecoveredCostFen: fen("100000"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
    });

    expect(result).toBe(fen("1006"));
    expect(netSellProceeds(100, result)).toBeGreaterThanOrEqual(fen("100000"));
    expect(netSellProceeds(100, result - fen("1"))).toBeLessThan(fen("100000"));
  });

  it("uses proportional commission above the minimum when finding break-even", () => {
    const schedule = {
      ...DEFAULT_PAPER_FEE_SCHEDULE,
      commissionRatePpm: 1000,
    };
    const unrecoveredCostFen = fen("12345678");
    const result = calculateBreakEvenStop({
      remainingQuantity: 10_000,
      unrecoveredCostFen,
      schedule,
    });
    const resultFees = calculateTradeFees({
      side: "sell",
      quantity: 10_000,
      priceFen: result,
      schedule,
    });

    expect(resultFees.commissionFen).toBeGreaterThan(fen("500"));
    expect(netSellProceeds(10_000, result, schedule)).toBeGreaterThanOrEqual(
      unrecoveredCostFen,
    );
    expect(netSellProceeds(10_000, result - fen("1"), schedule)).toBeLessThan(
      unrecoveredCostFen,
    );
  });

  it("returns a bigint price", () => {
    expect(
      typeof calculateBreakEvenStop({
        remainingQuantity: 100,
        unrecoveredCostFen: fen("100000"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }),
    ).toBe("bigint");
  });

  it.each([
    ["zero", 0],
    ["a negative quantity", -1],
    ["a fractional quantity", 1.5],
    ["NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["an unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ])("rejects %s as a remaining quantity", (_description, remainingQuantity) => {
    expect(() =>
      calculateBreakEvenStop({
        remainingQuantity,
        unrecoveredCostFen: fen("1"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }),
    ).toThrow("BREAK_EVEN_QUANTITY_INVALID");
  });

  it("rejects a negative unrecovered cost", () => {
    expect(() =>
      calculateBreakEvenStop({
        remainingQuantity: 100,
        unrecoveredCostFen: fen("-1"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }),
    ).toThrow("BREAK_EVEN_COST_INVALID");
  });

  it("preserves the SQLite overflow error for unrecovered cost", () => {
    expect(() =>
      calculateBreakEvenStop({
        remainingQuantity: 100,
        unrecoveredCostFen: sqliteInt64Max + fen("1"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }),
    ).toThrow("PAPER_ACCOUNT_BIGINT_OUT_OF_RANGE");
  });

  it("returns a positive price with non-negative proceeds for zero unrecovered cost", () => {
    const result = calculateBreakEvenStop({
      remainingQuantity: 100,
      unrecoveredCostFen: fen("0"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
    });

    expect(result).toBeGreaterThan(fen("0"));
    expect(netSellProceeds(100, result)).toBeGreaterThanOrEqual(fen("0"));
  });

  it("reports when no valid SQLite price can recover the requested cost", () => {
    expect(() =>
      calculateBreakEvenStop({
        remainingQuantity: 1,
        unrecoveredCostFen: sqliteInt64Max,
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }),
    ).toThrow("BREAK_EVEN_PRICE_UNAVAILABLE");
  });
});
