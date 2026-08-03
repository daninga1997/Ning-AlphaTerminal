import { describe, expect, it } from "vitest";

import { DEFAULT_PAPER_FEE_SCHEDULE } from "./fee-calculator";
import {
  calculatePlannedLoss,
  calculateRiskSizing,
} from "./risk-sizing";

const fen = (value: string): bigint => BigInt(value);

describe("paper trade risk sizing", () => {
  it("calculates planned loss with complete buy and stop-sell fees", () => {
    expect(
      calculatePlannedLoss({
        quantity: 100,
        buyPriceFen: fen("1000"),
        stopPriceFen: fen("900"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }),
    ).toEqual({
      buyNotionalFen: fen("100000"),
      buyFeesFen: fen("501"),
      stopSellNotionalFen: fen("90000"),
      stopSellFeesFen: fen("546"),
      plannedLossFen: fen("11047"),
    });
  });

  it("returns bigint for every planned-loss monetary field", () => {
    const result = calculatePlannedLoss({
      quantity: 100,
      buyPriceFen: fen("1000"),
      stopPriceFen: fen("900"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
    });

    expect(typeof result.buyNotionalFen).toBe("bigint");
    expect(typeof result.buyFeesFen).toBe("bigint");
    expect(typeof result.stopSellNotionalFen).toBe("bigint");
    expect(typeof result.stopSellFeesFen).toBe("bigint");
    expect(typeof result.plannedLossFen).toBe("bigint");
  });

  it.each([
    ["zero", 0],
    ["a negative quantity", -1],
    ["a fractional quantity", 1.5],
    ["NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["an unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ])("rejects %s as a planned-loss quantity", (_description, quantity) => {
    expect(() =>
      calculatePlannedLoss({
        quantity,
        buyPriceFen: fen("1000"),
        stopPriceFen: fen("900"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }),
    ).toThrow("RISK_QUANTITY_INVALID");
  });

  it.each([
    ["zero", fen("0")],
    ["a negative value", fen("-1")],
  ])("rejects %s as a buy price", (_description, buyPriceFen) => {
    expect(() =>
      calculatePlannedLoss({
        quantity: 100,
        buyPriceFen,
        stopPriceFen: fen("900"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }),
    ).toThrow("RISK_BUY_PRICE_INVALID");
  });

  it.each([
    ["zero", fen("0")],
    ["a negative value", fen("-1")],
  ])("rejects %s as a stop price", (_description, stopPriceFen) => {
    expect(() =>
      calculatePlannedLoss({
        quantity: 100,
        buyPriceFen: fen("1000"),
        stopPriceFen,
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }),
    ).toThrow("RISK_STOP_PRICE_INVALID");
  });

  it.each([
    ["an equal stop", fen("1000")],
    ["a higher stop", fen("1001")],
  ])("rejects %s price", (_description, stopPriceFen) => {
    expect(() =>
      calculatePlannedLoss({
        quantity: 100,
        buyPriceFen: fen("1000"),
        stopPriceFen,
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      }),
    ).toThrow("STOP_PRICE_MUST_BE_BELOW_BUY_PRICE");
  });

  it("rejects an equal stop price before calculating risk sizing", () => {
    expect(() =>
      calculateRiskSizing({
        equityFen: fen("1000000"),
        availableCashFen: fen("1000000"),
        existingStockMarketValueFen: fen("0"),
        existingTotalMarketValueFen: fen("0"),
        buyPriceFen: fen("1000"),
        stopPriceFen: fen("1000"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
        maxSingleStockBp: 3000,
        maxTotalPositionBp: 8000,
        maxRiskBp: 200,
      }),
    ).toThrow("STOP_PRICE_MUST_BE_BELOW_BUY_PRICE");
  });

  it("limits a new trade to the remaining 30 percent single-stock allocation", () => {
    const result = calculateRiskSizing({
      equityFen: fen("10000000"),
      availableCashFen: fen("10000000"),
      existingStockMarketValueFen: fen("2900000"),
      existingTotalMarketValueFen: fen("0"),
      buyPriceFen: fen("1000"),
      stopPriceFen: fen("900"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      maxSingleStockBp: 3000,
      maxTotalPositionBp: 8000,
      maxRiskBp: 2000,
    });

    expect(result.singleStockQuantity).toBe(100);
    expect(result.selectedQuantity).toBe(100);
    expect(result.limitingConstraint).toBe("single_stock");
  });

  it("limits a new trade to the remaining 80 percent total-position allocation", () => {
    const result = calculateRiskSizing({
      equityFen: fen("10000000"),
      availableCashFen: fen("10000000"),
      existingStockMarketValueFen: fen("0"),
      existingTotalMarketValueFen: fen("7900000"),
      buyPriceFen: fen("1000"),
      stopPriceFen: fen("900"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      maxSingleStockBp: 3000,
      maxTotalPositionBp: 8000,
      maxRiskBp: 2000,
    });

    expect(result.totalPositionQuantity).toBe(100);
    expect(result.selectedQuantity).toBe(100);
    expect(result.limitingConstraint).toBe("total_position");
  });

  it("includes complete buy fees when limiting quantity by available cash", () => {
    const result = calculateRiskSizing({
      equityFen: fen("10000000"),
      availableCashFen: fen("100501"),
      existingStockMarketValueFen: fen("0"),
      existingTotalMarketValueFen: fen("0"),
      buyPriceFen: fen("1000"),
      stopPriceFen: fen("900"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      maxSingleStockBp: 10000,
      maxTotalPositionBp: 10000,
      maxRiskBp: 10000,
    });

    expect(result.cashQuantity).toBe(100);
    expect(result.selectedQuantity).toBe(100);
    expect(result.limitingConstraint).toBe("cash");
  });

  it("continues cash binary search when a larger candidate fee overflows Int64", () => {
    const sqliteInt64Max = fen("9223372036854775807");
    const schedule = {
      ...DEFAULT_PAPER_FEE_SCHEDULE,
      commissionRatePpm: 3_000_000_000,
      minimumCommissionFen: fen("0"),
      stampDutySellRatePpm: 0,
      transferFeeRatePpm: 0,
    };
    const expectedCashQuantity = Number(
      ((sqliteInt64Max / fen("6002")) / fen("100")) * fen("100"),
    );

    const result = calculateRiskSizing({
      equityFen: sqliteInt64Max,
      availableCashFen: sqliteInt64Max,
      existingStockMarketValueFen: fen("0"),
      existingTotalMarketValueFen: fen("0"),
      buyPriceFen: fen("2"),
      stopPriceFen: fen("1"),
      schedule,
      maxSingleStockBp: 10_000,
      maxTotalPositionBp: 10_000,
      maxRiskBp: 10_000,
    });

    expect(result.cashQuantity).toBe(expectedCashQuantity);
  });

  it("limits quantity by complete-fee planned loss rather than a per-share approximation", () => {
    const result = calculateRiskSizing({
      equityFen: fen("1000000"),
      availableCashFen: fen("10000000"),
      existingStockMarketValueFen: fen("0"),
      existingTotalMarketValueFen: fen("0"),
      buyPriceFen: fen("1000"),
      stopPriceFen: fen("850"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      maxSingleStockBp: 10000,
      maxTotalPositionBp: 10000,
      maxRiskBp: 200,
    });

    expect(result.riskQuantity).toBe(100);
    expect(result.selectedQuantity).toBe(100);
    expect(result.limitingConstraint).toBe("risk");
  });

  it("selects the smallest candidate across risk, allocation, and cash limits", () => {
    const result = calculateRiskSizing({
      equityFen: fen("10000000"),
      availableCashFen: fen("201000"),
      existingStockMarketValueFen: fen("2500000"),
      existingTotalMarketValueFen: fen("7700000"),
      buyPriceFen: fen("1000"),
      stopPriceFen: fen("900"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      maxSingleStockBp: 3000,
      maxTotalPositionBp: 8000,
      maxRiskBp: 200,
    });

    expect(result.riskQuantity).toBe(1900);
    expect(result.singleStockQuantity).toBe(500);
    expect(result.totalPositionQuantity).toBe(300);
    expect(result.cashQuantity).toBe(200);
    expect(result.selectedQuantity).toBe(200);
    expect(result.limitingConstraint).toBe("cash");
  });

  it("rounds a 299-share candidate down to two board lots", () => {
    const result = calculateRiskSizing({
      equityFen: fen("10000000"),
      availableCashFen: fen("10000000"),
      existingStockMarketValueFen: fen("2701000"),
      existingTotalMarketValueFen: fen("0"),
      buyPriceFen: fen("1000"),
      stopPriceFen: fen("900"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      maxSingleStockBp: 3000,
      maxTotalPositionBp: 10000,
      maxRiskBp: 10000,
    });

    expect(result.singleStockQuantity).toBe(299);
    expect(result.selectedQuantity).toBe(200);
    expect(result.limitingConstraint).toBe("single_stock");
  });

  it("returns a board-lot limit when every non-risk candidate is below 100 shares", () => {
    const result = calculateRiskSizing({
      equityFen: fen("10000000"),
      availableCashFen: fen("10000000"),
      existingStockMarketValueFen: fen("2950000"),
      existingTotalMarketValueFen: fen("0"),
      buyPriceFen: fen("1000"),
      stopPriceFen: fen("900"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      maxSingleStockBp: 3000,
      maxTotalPositionBp: 10000,
      maxRiskBp: 10000,
    });

    expect(result.selectedQuantity).toBe(0);
    expect(result.limitingConstraint).toBe("board_lot");
    expect(result.riskExceptionRequired).toBe(false);
  });

  it("offers a 100-share risk exception only when its other constraints are satisfied", () => {
    const result = calculateRiskSizing({
      equityFen: fen("500000"),
      availableCashFen: fen("500000"),
      existingStockMarketValueFen: fen("0"),
      existingTotalMarketValueFen: fen("0"),
      buyPriceFen: fen("1000"),
      stopPriceFen: fen("900"),
      schedule: DEFAULT_PAPER_FEE_SCHEDULE,
      maxSingleStockBp: 3000,
      maxTotalPositionBp: 8000,
      maxRiskBp: 200,
    });

    expect(result.selectedQuantity).toBe(0);
    expect(result.riskExceptionRequired).toBe(true);
    expect(result.riskExceptionPlan).toEqual({
      quantity: 100,
      plannedLossFen: fen("11047"),
      actualRiskBp: 221,
      exceededRiskBp: 21,
    });
  });

  it.each([
    ["single-stock allocation", fen("100000"), fen("0"), fen("500000")],
    ["total-position allocation", fen("0"), fen("350000"), fen("500000")],
    ["available cash", fen("0"), fen("0"), fen("100000")],
  ])(
    "does not offer a risk exception when 100 shares exceed the %s limit",
    (_description, existingStockMarketValueFen, existingTotalMarketValueFen, availableCashFen) => {
      const result = calculateRiskSizing({
        equityFen: fen("500000"),
        availableCashFen,
        existingStockMarketValueFen,
        existingTotalMarketValueFen,
        buyPriceFen: fen("1000"),
        stopPriceFen: fen("900"),
        schedule: DEFAULT_PAPER_FEE_SCHEDULE,
        maxSingleStockBp: 3000,
        maxTotalPositionBp: 8000,
        maxRiskBp: 200,
      });

      expect(result.riskExceptionRequired).toBe(false);
      expect(result.riskExceptionPlan).toBeNull();
    },
  );
});
