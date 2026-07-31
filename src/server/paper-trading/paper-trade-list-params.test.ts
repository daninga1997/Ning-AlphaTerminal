import { describe, expect, it } from "vitest";
import { parsePaperTradeListParams } from "./paper-trade-list-params";

describe("parsePaperTradeListParams", () => {
  it("uses stable defaults for the paper trade ledger", () => {
    expect(parsePaperTradeListParams(new URLSearchParams())).toEqual({
      status: "all",
      sort: "entryTime",
    });
  });

  it("accepts only supported status and sort values", () => {
    expect(parsePaperTradeListParams(new URLSearchParams("status=closed&sort=returnPercent"))).toEqual({
      status: "closed",
      sort: "returnPercent",
    });
    expect(() => parsePaperTradeListParams(new URLSearchParams("status=anything"))).toThrow("INVALID_PAPER_TRADE_FILTER");
  });
});

