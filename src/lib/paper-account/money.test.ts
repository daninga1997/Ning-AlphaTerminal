import { describe, expect, it } from "vitest";

import {
  assertNonNegativeBigInt,
  assertSafeNonNegativeInteger,
  assertSqliteInt64,
  formatFen,
  multiplyByRatePpm,
  parseFen,
  roundDownToBoardLot,
  roundHalfUp,
  toDecimalString,
} from "./money";

const fen = (value: string): bigint => BigInt(value);

describe("money primitives", () => {
  it("rounds a rate-based fee half up to the nearest fen", () => {
    expect(multiplyByRatePpm(fen("10001"), 250)).toBe(fen("3"));
  });

  it("calculates a ten-ppm transfer fee using bigint rounding", () => {
    expect(multiplyByRatePpm(fen("1000000"), 10)).toBe(fen("10"));
  });

  it("rounds an exact half upward", () => {
    expect(roundHalfUp(fen("5"), fen("2"))).toBe(fen("3"));
  });

  it("rounds below half downward with an odd denominator", () => {
    expect(roundHalfUp(fen("4"), fen("3"))).toBe(fen("1"));
  });

  it("rounds above half upward with an odd denominator", () => {
    expect(roundHalfUp(fen("5"), fen("3"))).toBe(fen("2"));
  });

  it("rejects a zero denominator", () => {
    expect(() => roundHalfUp(fen("1"), fen("0"))).toThrow(
      "ROUND_DENOMINATOR_MUST_BE_POSITIVE",
    );
  });

  it("rejects a negative numerator", () => {
    expect(() => roundHalfUp(fen("-1"), fen("2"))).toThrow(
      "ROUND_NUMERATOR_MUST_BE_NON_NEGATIVE",
    );
  });

  it("formats five hundred fen as five yuan", () => {
    expect(formatFen(fen("500"))).toBe("5.00");
  });

  it("formats one fen as one cent", () => {
    expect(formatFen(fen("1"))).toBe("0.01");
  });

  it("formats zero fen as zero yuan", () => {
    expect(formatFen(fen("0"))).toBe("0.00");
  });

  it("formats one hundred thousand yuan without floating point conversion", () => {
    expect(formatFen(fen("10000000"))).toBe("100000.00");
  });

  it("parses a canonical decimal fen string", () => {
    expect(parseFen("500")).toBe(fen("500"));
  });

  it("parses canonical zero fen", () => {
    expect(parseFen("0")).toBe(fen("0"));
  });

  it("rejects an explicit positive sign when parsing fen", () => {
    expect(() => parseFen("+1")).toThrow(
      "PAPER_ACCOUNT_FEN_STRING_INVALID",
    );
  });

  it.each([
    ["an empty string", ""],
    ["a decimal value", "1.00"],
    ["a negative value", "-1"],
    ["an exponent value", "1e3"],
    ["leading whitespace", " 1"],
    ["trailing whitespace", "1 "],
    ["non-numeric text", "abc"],
    ["non-canonical leading zeroes", "000"],
  ])("rejects %s when parsing fen", (_description, value) => {
    expect(() => parseFen(value)).toThrow("PAPER_ACCOUNT_FEN_STRING_INVALID");
  });

  it("converts bigint to a decimal string", () => {
    expect(toDecimalString(fen("500"))).toBe("500");
  });

  it("returns a safe non-negative integer unchanged", () => {
    expect(assertSafeNonNegativeInteger(42, "INTEGER_INVALID")).toBe(42);
  });

  it.each([
    ["a negative number", -1],
    ["a fractional number", 1.5],
    ["NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["an unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ])("rejects %s as a safe non-negative integer", (_description, value) => {
    expect(() => assertSafeNonNegativeInteger(value, "INTEGER_INVALID")).toThrow(
      "INTEGER_INVALID",
    );
  });

  it("accepts the SQLite signed Int64 maximum", () => {
    expect(assertSqliteInt64(fen("9223372036854775807"))).toBe(
      fen("9223372036854775807"),
    );
  });

  it("rejects a value above the SQLite signed Int64 maximum", () => {
    expect(() => assertSqliteInt64(fen("9223372036854775808"))).toThrow(
      "PAPER_ACCOUNT_BIGINT_OUT_OF_RANGE",
    );
  });

  it("rejects a negative value outside the non-negative ledger domain", () => {
    expect(() => assertSqliteInt64(fen("-1"))).toThrow(
      "PAPER_ACCOUNT_BIGINT_OUT_OF_RANGE",
    );
  });

  it("returns a non-negative bigint unchanged", () => {
    expect(assertNonNegativeBigInt(fen("1"), "BIGINT_INVALID")).toBe(
      fen("1"),
    );
  });

  it("rejects a negative bigint", () => {
    expect(() => assertNonNegativeBigInt(fen("-1"), "BIGINT_INVALID")).toThrow(
      "BIGINT_INVALID",
    );
  });

  it.each([
    [0, 0],
    [99, 0],
    [100, 100],
    [199, 100],
    [299, 200],
  ])("rounds %i shares down to %i shares", (quantity, expected) => {
    expect(roundDownToBoardLot(quantity)).toBe(expected);
  });

  it.each([
    ["a negative share quantity", -1],
    ["a fractional share quantity", 1.5],
    ["NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
  ])("rejects %s as a board-lot quantity", (_description, quantity) => {
    expect(() => roundDownToBoardLot(quantity)).toThrow(
      "BOARD_LOT_QUANTITY_INVALID",
    );
  });
});
