import { describe, expect, it } from "vitest";
import { createManualPaperTradeSettlement, settlePaperTrade, type PaperTradeRecord } from "./paper-trade-settlement";

const trade: PaperTradeRecord = {
  id: "paper-1",
  code: "002472",
  name: "Shuanghuan Transmission",
  sector: "Robotics",
  entryPrice: 10,
  entryTime: "2026-07-20T01:30:00.000Z",
  entryTradingDate: "2026-07-20",
  takeProfitPrice: 12,
  stopLossPrice: 9,
  status: "open",
  exitPrice: null,
  exitTime: null,
  returnPercent: null,
  settlementReason: null,
  marketDataSource: "tencent",
  marketTimestamp: "2026-07-20T01:30:00.000Z",
  isDemo: true,
  createdAt: "2026-07-20T01:30:00.000Z",
  updatedAt: "2026-07-20T01:30:00.000Z",
};

describe("settlePaperTrade", () => {
  it("creates a manual settlement from the server quote", () => {
    expect(createManualPaperTradeSettlement(trade, 11.234)).toMatchObject({
      status: "manual_closed",
      exitPrice: 11.23,
      returnPercent: 12.3,
      settlementReason: "manual_closed",
    });
  });

  it("settles at the configured take-profit price when the latest quote reaches it", () => {
    expect(settlePaperTrade({ trade, latestQuotePrice: 12.3, completedDailyBars: [] })).toMatchObject({
      status: "take_profit",
      exitPrice: 12,
      returnPercent: 20,
    });
  });

  it("settles at the configured stop-loss price when the latest quote reaches it", () => {
    expect(settlePaperTrade({ trade, latestQuotePrice: 8.7, completedDailyBars: [] })).toMatchObject({
      status: "stop_loss",
      exitPrice: 9,
      returnPercent: -10,
    });
  });

  it("settles at the fifth completed trading-day close when no price trigger occurs", () => {
    const completedDailyBars = [
      { date: "2026-07-21", close: 10.1 },
      { date: "2026-07-22", close: 10.2 },
      { date: "2026-07-23", close: 10.3 },
      { date: "2026-07-24", close: 10.4 },
      { date: "2026-07-27", close: 10.5 },
    ];

    expect(settlePaperTrade({ trade, latestQuotePrice: 10.4, completedDailyBars })).toMatchObject({
      status: "expired",
      exitPrice: 10.5,
      returnPercent: 5,
      settledTradingDate: "2026-07-27",
    });
  });
});
