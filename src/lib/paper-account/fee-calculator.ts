import {
  assertNonNegativeBigInt,
  assertSafeNonNegativeInteger,
  assertSqliteInt64,
  multiplyByRatePpm,
} from "./money";

const ZERO = BigInt("0");

export type TradeSide = "buy" | "sell";

export type FeeSchedule = {
  commissionRatePpm: number;
  minimumCommissionFen: bigint;
  stampDutySellRatePpm: number;
  transferFeeRatePpm: number;
};

export type CalculateTradeFeesInput = {
  side: TradeSide;
  quantity: number;
  priceFen: bigint;
  schedule: FeeSchedule;
};

export type TradeFeeBreakdown = {
  notionalFen: bigint;
  commissionFen: bigint;
  stampDutyFen: bigint;
  transferFeeFen: bigint;
  totalFeeFen: bigint;
};

export const DEFAULT_PAPER_FEE_SCHEDULE: FeeSchedule = {
  commissionRatePpm: 250,
  minimumCommissionFen: BigInt("500"),
  stampDutySellRatePpm: 500,
  transferFeeRatePpm: 10,
};

export function calculateTradeFees(
  input: CalculateTradeFeesInput,
): TradeFeeBreakdown {
  validateSide(input.side);
  const quantity = validateQuantity(input.quantity);
  const priceFen = validatePrice(input.priceFen);
  const schedule = validateSchedule(input.schedule);
  const notionalFen = assertSqliteInt64(BigInt(quantity) * priceFen);
  const proportionalCommissionFen = multiplyByRatePpm(
    notionalFen,
    schedule.commissionRatePpm,
  );
  const commissionFen =
    proportionalCommissionFen > schedule.minimumCommissionFen
      ? proportionalCommissionFen
      : schedule.minimumCommissionFen;
  const stampDutyFen =
    input.side === "sell"
      ? multiplyByRatePpm(notionalFen, schedule.stampDutySellRatePpm)
      : ZERO;
  const transferFeeFen = multiplyByRatePpm(
    notionalFen,
    schedule.transferFeeRatePpm,
  );
  const totalFeeFen = assertSqliteInt64(
    commissionFen + stampDutyFen + transferFeeFen,
  );

  return {
    notionalFen,
    commissionFen,
    stampDutyFen,
    transferFeeFen,
    totalFeeFen,
  };
}

function validateSide(side: TradeSide): void {
  if (side !== "buy" && side !== "sell") {
    throw new Error("TRADE_SIDE_INVALID");
  }
}

function validateQuantity(quantity: number): number {
  const validQuantity = assertSafeNonNegativeInteger(
    quantity,
    "TRADE_QUANTITY_INVALID",
  );

  if (validQuantity === 0) {
    throw new Error("TRADE_QUANTITY_INVALID");
  }

  return validQuantity;
}

function validatePrice(priceFen: bigint): bigint {
  assertNonNegativeBigInt(priceFen, "TRADE_PRICE_INVALID");

  if (priceFen === ZERO) {
    throw new Error("TRADE_PRICE_INVALID");
  }

  try {
    return assertSqliteInt64(priceFen);
  } catch {
    throw new Error("TRADE_PRICE_INVALID");
  }
}

function validateSchedule(schedule: FeeSchedule): FeeSchedule {
  assertSafeNonNegativeInteger(
    schedule.commissionRatePpm,
    "COMMISSION_RATE_INVALID",
  );
  assertSafeNonNegativeInteger(
    schedule.stampDutySellRatePpm,
    "STAMP_DUTY_RATE_INVALID",
  );
  assertSafeNonNegativeInteger(
    schedule.transferFeeRatePpm,
    "TRANSFER_FEE_RATE_INVALID",
  );
  assertNonNegativeBigInt(
    schedule.minimumCommissionFen,
    "MINIMUM_COMMISSION_INVALID",
  );
  assertSqliteInt64(schedule.minimumCommissionFen);

  return schedule;
}
