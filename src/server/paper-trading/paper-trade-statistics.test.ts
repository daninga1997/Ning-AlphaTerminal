import { describe, expect, it } from "vitest";
import type { PaperTradeRecord } from "./paper-trade-settlement";
import { calculatePaperTradeStatistics, filterPaperTrades, sortPaperTrades } from "./paper-trade-statistics";

function trade(overrides: Partial<PaperTradeRecord>): PaperTradeRecord {
  return {
    id: "trade-1",
    code: "002472",
    name: "Shuanghuan Transmission",
    sector: "Robotics",
    entryPrice: 10,
    entryTime: "2026-07-20T01:30:00.000Z",
    entryTradingDate: "2026-07-20",
    takeProfitPrice: 12,
    stopLossPrice: 9,
    status: "take_profit",
    exitPrice: 11,
    exitTime: "2026-07-21T01:30:00.000Z",
    returnPercent: 10,
    settlementReason: "take_profit_reached",
    marketDataSource: "tencent",
    marketTimestamp: "2026-07-20T01:30:00.000Z",
    isDemo: true,
    createdAt: "2026-07-20T01:30:00.000Z",
    updatedAt: "2026-07-20T01:30:00.000Z",
    ...overrides,
  };
}

describe("paper trade statistics", () => {
  it("excludes open trades from realized statistics", () => {
    expect(calculatePaperTradeStatistics([
      trade({ id: "win", returnPercent: 10 }),
      trade({ id: "loss", returnPercent: -5 }),
      trade({ id: "open", status: "open", exitPrice: null, exitTime: null, returnPercent: null }),
    ])).toEqual({
      totalCount: 3,
      settledCount: 2,
      winRate: 50,
      totalReturnPercent: 5,
      averageReturnPercent: 2.5,
    });
  });

  it("filters open trades and sorts closed trades by return percent", () => {
    const open = trade({ id: "open", status: "open", returnPercent: null, exitPrice: null, exitTime: null });
    const loss = trade({ id: "loss", returnPercent: -5 });
    const win = trade({ id: "win", returnPercent: 10 });

    expect(filterPaperTrades([open, loss, win], "open")).toEqual([open]);
    expect(sortPaperTrades([loss, win], "returnPercent").map((item) => item.id)).toEqual(["win", "loss"]);
  });

  it("returns null realized metrics when no trade has settled", () => {
    expect(calculatePaperTradeStatistics([
      trade({ status: "open", exitPrice: null, exitTime: null, returnPercent: null }),
    ])).toEqual({
      totalCount: 1,
      settledCount: 0,
      winRate: null,
      totalReturnPercent: null,
      averageReturnPercent: null,
    });
  });
});

