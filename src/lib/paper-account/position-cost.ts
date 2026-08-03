import {
  assertNonNegativeBigInt,
  assertSafeNonNegativeInteger,
  assertSqliteInt64,
  roundHalfUp,
} from "./money";
import type {
  MoneyFen,
  PriceFen,
} from "./paper-account-types";

const ZERO = BigInt("0");

export type CostLot = {
  quantity: number;
  priceFen: PriceFen;
  buyFeeFen: MoneyFen;
};

export type WeightedPositionCost = {
  totalQuantity: number;
  totalCostFen: MoneyFen;
  averageCostFen: PriceFen;
};

export function calculateWeightedPositionCost(
  lots: CostLot[],
): WeightedPositionCost {
  if (lots.length === 0) {
    throw new Error("POSITION_COST_LOTS_REQUIRED");
  }

  let totalQuantity = 0;
  let totalCostFen = ZERO;

  for (const lot of lots) {
    const quantity = validateQuantity(lot.quantity);
    const priceFen = validatePrice(lot.priceFen);
    const buyFeeFen = validateBuyFee(lot.buyFeeFen);

    if (totalQuantity > Number.MAX_SAFE_INTEGER - quantity) {
      throw new Error("POSITION_COST_QUANTITY_INVALID");
    }

    const lotCostFen = assertSqliteInt64(
      BigInt(quantity) * priceFen + buyFeeFen,
    );
    totalQuantity += quantity;
    totalCostFen = assertSqliteInt64(totalCostFen + lotCostFen);
  }

  return {
    totalQuantity,
    totalCostFen,
    averageCostFen: roundHalfUp(totalCostFen, BigInt(totalQuantity)),
  };
}

function validateQuantity(quantity: number): number {
  const validQuantity = assertSafeNonNegativeInteger(
    quantity,
    "POSITION_COST_QUANTITY_INVALID",
  );

  if (validQuantity === 0) {
    throw new Error("POSITION_COST_QUANTITY_INVALID");
  }

  return validQuantity;
}

function validatePrice(priceFen: PriceFen): PriceFen {
  assertNonNegativeBigInt(priceFen, "POSITION_COST_PRICE_INVALID");

  if (priceFen === ZERO) {
    throw new Error("POSITION_COST_PRICE_INVALID");
  }

  return assertSqliteInt64(priceFen);
}

function validateBuyFee(buyFeeFen: MoneyFen): MoneyFen {
  assertNonNegativeBigInt(buyFeeFen, "POSITION_COST_BUY_FEE_INVALID");
  return assertSqliteInt64(buyFeeFen);
}
