import type { BoardLotQuantity } from "./paper-account-types";

const ZERO = BigInt("0");
const SQLITE_INT64_MAX = BigInt("9223372036854775807");
const FEN_PER_YUAN = BigInt("100");
const PPM_DENOMINATOR = BigInt("1000000");

export function assertNonNegativeBigInt(value: bigint, code: string): bigint {
  if (value < ZERO) {
    throw new Error(code);
  }

  return value;
}

export function assertSafeNonNegativeInteger(
  value: number,
  code: string,
): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(code);
  }

  return value;
}

export function assertSqliteInt64(value: bigint): bigint {
  if (value < ZERO || value > SQLITE_INT64_MAX) {
    throw new Error("PAPER_ACCOUNT_BIGINT_OUT_OF_RANGE");
  }

  return value;
}

export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < ZERO) {
    throw new Error("ROUND_NUMERATOR_MUST_BE_NON_NEGATIVE");
  }

  if (denominator <= ZERO) {
    throw new Error("ROUND_DENOMINATOR_MUST_BE_POSITIVE");
  }

  const quotient = numerator / denominator;
  const remainder = numerator % denominator;

  return remainder * BigInt("2") >= denominator
    ? quotient + BigInt("1")
    : quotient;
}

export function multiplyByRatePpm(
  amountFen: bigint,
  ratePpm: number,
): bigint {
  assertSqliteInt64(amountFen);
  assertSafeNonNegativeInteger(ratePpm, "RATE_PPM_INVALID");

  const result = roundHalfUp(amountFen * BigInt(ratePpm), PPM_DENOMINATOR);
  return assertSqliteInt64(result);
}

export function roundDownToBoardLot(quantity: number): BoardLotQuantity {
  const validQuantity = assertSafeNonNegativeInteger(
    quantity,
    "BOARD_LOT_QUANTITY_INVALID",
  );

  return Math.floor(validQuantity / 100) * 100;
}

export function formatFen(amountFen: bigint): string {
  const value = assertSqliteInt64(amountFen);
  const yuan = value / FEN_PER_YUAN;
  const fen = (value % FEN_PER_YUAN).toString().padStart(2, "0");

  return `${yuan}.${fen}`;
}

export function parseFen(value: string): bigint {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("PAPER_ACCOUNT_FEN_STRING_INVALID");
  }

  return assertSqliteInt64(BigInt(value));
}

export function toDecimalString(value: bigint): string {
  return value.toString();
}
