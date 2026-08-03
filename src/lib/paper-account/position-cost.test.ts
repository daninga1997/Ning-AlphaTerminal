import { describe, expect, it } from "vitest";

import { calculateWeightedPositionCost } from "./position-cost";

const fen = (value: string): bigint => BigInt(value);
const sqliteInt64Max = fen("9223372036854775807");

describe("paper position cost", () => {
  it("calculates inclusive-fee weighted cost across two buys", () => {
    expect(
      calculateWeightedPositionCost([
        { quantity: 100, priceFen: fen("1000"), buyFeeFen: fen("500") },
        { quantity: 100, priceFen: fen("1200"), buyFeeFen: fen("500") },
      ]),
    ).toEqual({
      totalQuantity: 200,
      totalCostFen: fen("221000"),
      averageCostFen: fen("1105"),
    });
  });

  it("rounds a non-divisible average cost half up after total aggregation", () => {
    expect(
      calculateWeightedPositionCost([
        { quantity: 3, priceFen: fen("1000"), buyFeeFen: fen("2") },
      ]).averageCostFen,
    ).toBe(fen("1001"));
  });

  it("calculates all fields for a single lot", () => {
    expect(
      calculateWeightedPositionCost([
        { quantity: 100, priceFen: fen("1234"), buyFeeFen: fen("500") },
      ]),
    ).toEqual({
      totalQuantity: 100,
      totalCostFen: fen("123900"),
      averageCostFen: fen("1239"),
    });
  });

  it("returns bigint for cost and average price", () => {
    const result = calculateWeightedPositionCost([
      { quantity: 100, priceFen: fen("1000"), buyFeeFen: fen("500") },
    ]);

    expect(typeof result.totalCostFen).toBe("bigint");
    expect(typeof result.averageCostFen).toBe("bigint");
  });

  it("rejects an empty lot list", () => {
    expect(() => calculateWeightedPositionCost([])).toThrow(
      "POSITION_COST_LOTS_REQUIRED",
    );
  });

  it.each([
    ["zero", 0],
    ["a negative quantity", -1],
    ["a fractional quantity", 1.5],
    ["NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["an unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ])("rejects %s as a lot quantity", (_description, quantity) => {
    expect(() =>
      calculateWeightedPositionCost([
        { quantity, priceFen: fen("1000"), buyFeeFen: fen("0") },
      ]),
    ).toThrow("POSITION_COST_QUANTITY_INVALID");
  });

  it.each([
    ["zero", fen("0")],
    ["a negative price", fen("-1")],
  ])("rejects %s as a lot price", (_description, priceFen) => {
    expect(() =>
      calculateWeightedPositionCost([
        { quantity: 1, priceFen, buyFeeFen: fen("0") },
      ]),
    ).toThrow("POSITION_COST_PRICE_INVALID");
  });

  it("rejects a negative buy fee", () => {
    expect(() =>
      calculateWeightedPositionCost([
        { quantity: 1, priceFen: fen("1"), buyFeeFen: fen("-1") },
      ]),
    ).toThrow("POSITION_COST_BUY_FEE_INVALID");
  });

  it.each([
    ["a price above SQLite Int64", 1, sqliteInt64Max + fen("1"), fen("0")],
    ["a fee above SQLite Int64", 1, fen("1"), sqliteInt64Max + fen("1")],
    ["a single-lot cost above SQLite Int64", 2, sqliteInt64Max, fen("0")],
  ])("preserves the SQLite overflow error for %s", (_description, quantity, priceFen, buyFeeFen) => {
    expect(() =>
      calculateWeightedPositionCost([{ quantity, priceFen, buyFeeFen }]),
    ).toThrow("PAPER_ACCOUNT_BIGINT_OUT_OF_RANGE");
  });

  it("preserves the SQLite overflow error for cumulative cost", () => {
    expect(() =>
      calculateWeightedPositionCost([
        { quantity: 1, priceFen: sqliteInt64Max, buyFeeFen: fen("0") },
        { quantity: 1, priceFen: fen("1"), buyFeeFen: fen("0") },
      ]),
    ).toThrow("PAPER_ACCOUNT_BIGINT_OUT_OF_RANGE");
  });

  it("rejects cumulative quantity above the safe integer maximum", () => {
    expect(() =>
      calculateWeightedPositionCost([
        {
          quantity: Number.MAX_SAFE_INTEGER,
          priceFen: fen("1"),
          buyFeeFen: fen("0"),
        },
        {
          quantity: 1,
          priceFen: fen("1"),
          buyFeeFen: fen("0"),
        },
      ]),
    ).toThrow("POSITION_COST_QUANTITY_INVALID");
  });
});
