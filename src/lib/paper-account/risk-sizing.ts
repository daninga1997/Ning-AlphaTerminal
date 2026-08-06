import {
  calculateTradeFees,
  type FeeSchedule,
} from "./fee-calculator";
import type {
  BasisPoints,
  BoardLotQuantity,
  MoneyFen,
  PriceFen,
} from "./paper-account-types";
import {
  assertNonNegativeBigInt,
  assertSafeNonNegativeInteger,
  assertSqliteInt64,
  roundDownToBoardLot,
} from "./money";

const ZERO = BigInt("0");
const ONE = BigInt("1");
const HUNDRED = 100;
const TEN_THOUSAND = BigInt("10000");
const SQLITE_INT64_MAX = BigInt("9223372036854775807");
const MAX_SAFE_QUANTITY = BigInt(Number.MAX_SAFE_INTEGER);

export type PlannedLossResult = {
  buyNotionalFen: MoneyFen;
  buyFeesFen: MoneyFen;
  stopSellNotionalFen: MoneyFen;
  stopSellFeesFen: MoneyFen;
  plannedLossFen: MoneyFen;
};

export type RiskExceptionPlan = {
  quantity: 100;
  plannedLossFen: MoneyFen;
  actualRiskBp: BasisPoints;
  exceededRiskBp: BasisPoints;
};

export type RiskSizingInput = {
  equityFen: MoneyFen;
  availableCashFen: MoneyFen;
  existingStockMarketValueFen: MoneyFen;
  existingTotalMarketValueFen: MoneyFen;
  buyPriceFen: PriceFen;
  stopPriceFen: PriceFen;
  schedule: FeeSchedule;
  maxSingleStockBp: BasisPoints;
  maxTotalPositionBp: BasisPoints;
  maxRiskBp: BasisPoints;
};

export type RiskSizingResult = {
  riskQuantity: BoardLotQuantity;
  singleStockQuantity: BoardLotQuantity;
  totalPositionQuantity: BoardLotQuantity;
  cashQuantity: BoardLotQuantity;
  selectedQuantity: BoardLotQuantity;
  limitingConstraint:
    | "risk"
    | "single_stock"
    | "total_position"
    | "cash"
    | "board_lot"
    | "none";
  riskExceptionRequired: boolean;
  riskExceptionPlan: RiskExceptionPlan | null;
};

export function calculatePlannedLoss(input: {
  quantity: BoardLotQuantity;
  buyPriceFen: PriceFen;
  stopPriceFen: PriceFen;
  schedule: FeeSchedule;
}): PlannedLossResult {
  const quantity = validateQuantity(input.quantity);
  const buyPriceFen = validatePrice(
    input.buyPriceFen,
    "RISK_BUY_PRICE_INVALID",
  );
  const stopPriceFen = validatePrice(
    input.stopPriceFen,
    "RISK_STOP_PRICE_INVALID",
  );

  if (stopPriceFen >= buyPriceFen) {
    throw new Error("STOP_PRICE_MUST_BE_BELOW_BUY_PRICE");
  }

  const buy = calculateTradeFees({
    side: "buy",
    quantity,
    priceFen: buyPriceFen,
    schedule: input.schedule,
  });
  const stopSell = calculateTradeFees({
    side: "sell",
    quantity,
    priceFen: stopPriceFen,
    schedule: input.schedule,
  });
  const plannedLossFen = assertSqliteInt64(
    buy.notionalFen +
      buy.totalFeeFen -
      stopSell.notionalFen +
      stopSell.totalFeeFen,
  );

  return {
    buyNotionalFen: buy.notionalFen,
    buyFeesFen: buy.totalFeeFen,
    stopSellNotionalFen: stopSell.notionalFen,
    stopSellFeesFen: stopSell.totalFeeFen,
    plannedLossFen,
  };
}

export function calculateRiskSizing(
  input: RiskSizingInput,
): RiskSizingResult {
  const validatedInput = validateRiskSizingInput(input);
  const singleStockQuantity = calculatePositionQuantity(
    validatedInput.equityFen,
    validatedInput.maxSingleStockBp,
    validatedInput.existingStockMarketValueFen,
    validatedInput.buyPriceFen,
  );
  const totalPositionQuantity = calculatePositionQuantity(
    validatedInput.equityFen,
    validatedInput.maxTotalPositionBp,
    validatedInput.existingTotalMarketValueFen,
    validatedInput.buyPriceFen,
  );
  const cashQuantity = calculateCashQuantity(validatedInput);
  const riskQuantity = calculateRiskQuantity(validatedInput);
  const allocationQuantity = roundDownToBoardLot(
    Math.min(singleStockQuantity, totalPositionQuantity, cashQuantity),
  );
  const selectedQuantity = Math.min(allocationQuantity, riskQuantity);
  const riskExceptionPlan = calculateRiskExceptionPlan(
    validatedInput,
    singleStockQuantity,
    totalPositionQuantity,
    cashQuantity,
    riskQuantity,
  );

  return {
    riskQuantity,
    singleStockQuantity,
    totalPositionQuantity,
    cashQuantity,
    selectedQuantity,
    limitingConstraint: determineLimitingConstraint({
      riskQuantity,
      singleStockQuantity,
      totalPositionQuantity,
      cashQuantity,
      allocationQuantity,
      selectedQuantity,
    }),
    riskExceptionRequired: riskExceptionPlan !== null,
    riskExceptionPlan,
  };
}

function validateQuantity(quantity: number): number {
  const validQuantity = assertSafeNonNegativeInteger(
    quantity,
    "RISK_QUANTITY_INVALID",
  );

  if (validQuantity === 0) {
    throw new Error("RISK_QUANTITY_INVALID");
  }

  return validQuantity;
}

function validatePrice(priceFen: bigint, code: string): bigint {
  try {
    assertNonNegativeBigInt(priceFen, code);

    if (priceFen === ZERO) {
      throw new Error(code);
    }

    return assertSqliteInt64(priceFen);
  } catch {
    throw new Error(code);
  }
}

function validateRiskSizingInput(input: RiskSizingInput): RiskSizingInput {
  const buyPriceFen = validatePrice(input.buyPriceFen, "RISK_BUY_PRICE_INVALID");
  const stopPriceFen = validatePrice(
    input.stopPriceFen,
    "RISK_STOP_PRICE_INVALID",
  );

  if (stopPriceFen >= buyPriceFen) {
    throw new Error("STOP_PRICE_MUST_BE_BELOW_BUY_PRICE");
  }

  return {
    ...input,
    equityFen: validatePositiveValue(input.equityFen, "RISK_EQUITY_INVALID"),
    availableCashFen: validateNonNegativeValue(
      input.availableCashFen,
      "RISK_AVAILABLE_CASH_INVALID",
    ),
    existingStockMarketValueFen: validateNonNegativeValue(
      input.existingStockMarketValueFen,
      "RISK_EXISTING_STOCK_VALUE_INVALID",
    ),
    existingTotalMarketValueFen: validateNonNegativeValue(
      input.existingTotalMarketValueFen,
      "RISK_EXISTING_TOTAL_VALUE_INVALID",
    ),
    buyPriceFen,
    stopPriceFen,
    maxSingleStockBp: validateBasisPoints(input.maxSingleStockBp),
    maxTotalPositionBp: validateBasisPoints(input.maxTotalPositionBp),
    maxRiskBp: validateBasisPoints(input.maxRiskBp),
  };
}

function validatePositiveValue(value: bigint, code: string): bigint {
  const validValue = validateNonNegativeValue(value, code);

  if (validValue === ZERO) {
    throw new Error(code);
  }

  return validValue;
}

function validateNonNegativeValue(value: bigint, code: string): bigint {
  try {
    assertNonNegativeBigInt(value, code);
    return assertSqliteInt64(value);
  } catch {
    throw new Error(code);
  }
}

function validateBasisPoints(value: number): number {
  const validValue = assertSafeNonNegativeInteger(
    value,
    "RISK_BASIS_POINTS_INVALID",
  );

  if (validValue > Number(TEN_THOUSAND)) {
    throw new Error("RISK_BASIS_POINTS_INVALID");
  }

  return validValue;
}

function calculatePositionQuantity(
  equityFen: bigint,
  maximumPositionBp: number,
  existingMarketValueFen: bigint,
  buyPriceFen: bigint,
): number {
  const maximumMarketValueFen =
    (equityFen * BigInt(maximumPositionBp)) / TEN_THOUSAND;
  const availableMarketValueFen =
    maximumMarketValueFen > existingMarketValueFen
      ? maximumMarketValueFen - existingMarketValueFen
      : ZERO;

  return toSafeQuantity(availableMarketValueFen / buyPriceFen);
}

function calculateCashQuantity(input: RiskSizingInput): number {
  const upperQuantity = roundDownToBoardLot(
    Math.min(
      toSafeQuantity(input.availableCashFen / input.buyPriceFen),
      maximumQuantityForPrice(input.buyPriceFen),
    ),
  );

  return findMaximumBoardLot(upperQuantity, (quantity) => {
    try {
      const fees = calculateTradeFees({
        side: "buy",
        quantity,
        priceFen: input.buyPriceFen,
        schedule: input.schedule,
      });

      return fees.notionalFen + fees.totalFeeFen <= input.availableCashFen;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "PAPER_ACCOUNT_BIGINT_OUT_OF_RANGE"
      ) {
        return false;
      }

      throw error;
    }
  });
}

function calculateRiskQuantity(input: RiskSizingInput): number {
  const maximumLossFen =
    (input.equityFen * BigInt(input.maxRiskBp)) / TEN_THOUSAND;
  const priceRiskPerShareFen = input.buyPriceFen - input.stopPriceFen;
  const upperQuantity = roundDownToBoardLot(
    Math.min(
      toSafeQuantity(maximumLossFen / priceRiskPerShareFen),
      maximumQuantityForPrice(input.buyPriceFen),
    ),
  );

  return findMaximumBoardLot(upperQuantity, (quantity) => {
    try {
      return (
        calculatePlannedLoss({
          quantity,
          buyPriceFen: input.buyPriceFen,
          stopPriceFen: input.stopPriceFen,
          schedule: input.schedule,
        }).plannedLossFen <= maximumLossFen
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "PAPER_ACCOUNT_BIGINT_OUT_OF_RANGE"
      ) {
        return false;
      }

      throw error;
    }
  });
}

function maximumQuantityForPrice(priceFen: bigint): number {
  return toSafeQuantity(SQLITE_INT64_MAX / priceFen);
}

function findMaximumBoardLot(
  upperQuantity: number,
  acceptsQuantity: (quantity: number) => boolean,
): number {
  let lowLots = 0;
  let highLots = Math.floor(upperQuantity / HUNDRED);

  while (lowLots < highLots) {
    const middleLots = Math.floor((lowLots + highLots + 1) / 2);
    const quantity = middleLots * HUNDRED;

    if (acceptsQuantity(quantity)) {
      lowLots = middleLots;
    } else {
      highLots = middleLots - 1;
    }
  }

  return lowLots * HUNDRED;
}

function calculateRiskExceptionPlan(
  input: RiskSizingInput,
  singleStockQuantity: number,
  totalPositionQuantity: number,
  cashQuantity: number,
  riskQuantity: number,
): RiskExceptionPlan | null {
  if (
    riskQuantity >= HUNDRED ||
    singleStockQuantity < HUNDRED ||
    totalPositionQuantity < HUNDRED ||
    cashQuantity < HUNDRED
  ) {
    return null;
  }

  const plannedLossFen = calculatePlannedLoss({
    quantity: HUNDRED,
    buyPriceFen: input.buyPriceFen,
    stopPriceFen: input.stopPriceFen,
    schedule: input.schedule,
  }).plannedLossFen;
  const actualRiskBp = toSafeQuantity(
    (plannedLossFen * TEN_THOUSAND + input.equityFen - ONE) /
      input.equityFen,
  );

  if (actualRiskBp <= input.maxRiskBp) {
    return null;
  }

  return {
    quantity: HUNDRED,
    plannedLossFen,
    actualRiskBp,
    exceededRiskBp: actualRiskBp - input.maxRiskBp,
  };
}

function determineLimitingConstraint(input: {
  riskQuantity: number;
  singleStockQuantity: number;
  totalPositionQuantity: number;
  cashQuantity: number;
  allocationQuantity: number;
  selectedQuantity: number;
}): RiskSizingResult["limitingConstraint"] {
  if (input.allocationQuantity === 0) {
    return "board_lot";
  }

  if (input.selectedQuantity === 0 || input.riskQuantity <= input.allocationQuantity) {
    return "risk";
  }

  const smallestAllocationQuantity = Math.min(
    input.singleStockQuantity,
    input.totalPositionQuantity,
    input.cashQuantity,
  );

  if (smallestAllocationQuantity === input.singleStockQuantity) {
    return "single_stock";
  }

  if (smallestAllocationQuantity === input.totalPositionQuantity) {
    return "total_position";
  }

  if (smallestAllocationQuantity === input.cashQuantity) {
    return "cash";
  }

  return "none";
}

function toSafeQuantity(value: bigint): number {
  return Number(value > MAX_SAFE_QUANTITY ? MAX_SAFE_QUANTITY : value);
}
