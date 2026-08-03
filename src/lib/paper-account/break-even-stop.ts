import {
  calculateTradeFees,
  type FeeSchedule,
} from "./fee-calculator";
import {
  assertNonNegativeBigInt,
  assertSafeNonNegativeInteger,
  assertSqliteInt64,
} from "./money";
import type {
  MoneyFen,
  PriceFen,
} from "./paper-account-types";

const ONE = BigInt("1");
const TWO = BigInt("2");
const SQLITE_INT64_MAX = BigInt("9223372036854775807");

export type BreakEvenStopInput = {
  remainingQuantity: number;
  unrecoveredCostFen: MoneyFen;
  schedule: FeeSchedule;
};

export function calculateBreakEvenStop(
  input: BreakEvenStopInput,
): PriceFen {
  const remainingQuantity = validateQuantity(input.remainingQuantity);
  const unrecoveredCostFen = validateCost(input.unrecoveredCostFen);
  const maximumPriceFen = SQLITE_INT64_MAX / BigInt(remainingQuantity);
  let highPriceFen = ONE;

  while (
    calculateNetProceeds(
      remainingQuantity,
      highPriceFen,
      input.schedule,
    ) < unrecoveredCostFen
  ) {
    if (highPriceFen === maximumPriceFen) {
      throw new Error("BREAK_EVEN_PRICE_UNAVAILABLE");
    }

    const doubledPriceFen = highPriceFen * TWO;
    highPriceFen =
      doubledPriceFen > maximumPriceFen ? maximumPriceFen : doubledPriceFen;
  }

  let lowPriceFen = ONE;

  while (lowPriceFen < highPriceFen) {
    const middlePriceFen = (lowPriceFen + highPriceFen) / TWO;

    if (
      calculateNetProceeds(
        remainingQuantity,
        middlePriceFen,
        input.schedule,
      ) >= unrecoveredCostFen
    ) {
      highPriceFen = middlePriceFen;
    } else {
      lowPriceFen = middlePriceFen + ONE;
    }
  }

  return assertSqliteInt64(lowPriceFen);
}

function validateQuantity(quantity: number): number {
  const validQuantity = assertSafeNonNegativeInteger(
    quantity,
    "BREAK_EVEN_QUANTITY_INVALID",
  );

  if (validQuantity === 0) {
    throw new Error("BREAK_EVEN_QUANTITY_INVALID");
  }

  return validQuantity;
}

function validateCost(unrecoveredCostFen: MoneyFen): MoneyFen {
  assertNonNegativeBigInt(unrecoveredCostFen, "BREAK_EVEN_COST_INVALID");
  return assertSqliteInt64(unrecoveredCostFen);
}

function calculateNetProceeds(
  quantity: number,
  priceFen: PriceFen,
  schedule: FeeSchedule,
): MoneyFen {
  const fees = calculateTradeFees({
    side: "sell",
    quantity,
    priceFen,
    schedule,
  });

  return fees.notionalFen - fees.totalFeeFen;
}
