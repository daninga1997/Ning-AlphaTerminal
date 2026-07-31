import { describe, expect, it } from "vitest";
import { createPaperTradeMarketService, type PaperTradeMarketSnapshot } from "./paper-trade-market-service";
import type { PaperTradeListStatus, PaperTradeSort } from "./paper-trade-statistics";
import type { CreatePaperTradeInput, PaperTradeRepository } from "./paper-trade-repository";
import type { PaperTradeRecord, PaperTradeSettlement } from "./paper-trade-settlement";

class MemoryPaperTradeRepository implements PaperTradeRepository {
  trades: PaperTradeRecord[] = [];

  async createOpen(input: CreatePaperTradeInput) {
    const trade: PaperTradeRecord = {
      id: "paper-1",
      ...input,
      status: "open",
      exitPrice: null,
      exitTime: null,
      returnPercent: null,
      settlementReason: null,
      createdAt: input.entryTime,
      updatedAt: input.entryTime,
    };
    this.trades.push(trade);
    return trade;
  }

  async findOpenByCode(code: string) {
    return this.trades.find((trade) => trade.code === code && trade.status === "open") ?? null;
  }

  async findById(id: string) {
    return this.trades.find((trade) => trade.id === id) ?? null;
  }

  async listByCode(code: string) {
    return this.trades.filter((trade) => trade.code === code);
  }

  async listOpen() {
    return this.trades.filter((trade) => trade.status === "open");
  }

  async listAll() {
    return this.trades;
  }

  async settle(id: string, settlement: PaperTradeSettlement, exitTime: string) {
    const trade = this.trades.find((candidate) => candidate.id === id);
    if (!trade) throw new Error("missing trade");
    Object.assign(trade, {
      ...settlement,
      exitTime,
      openKey: undefined,
    });
    return trade;
  }
}

const snapshot: PaperTradeMarketSnapshot = {
  code: "002472",
  name: "Shuanghuan Transmission",
  sector: "Robotics",
  quote: {
    price: 35.75,
    marketTimestamp: "2026-07-29T11:00:00+08:00",
    source: "tencent",
  },
  takeProfitPrice: 40,
  stopLossPrice: 32,
  completedDailyBars: [],
};

describe("paper trade market service", () => {
  it("creates a demo trade from the server market snapshot rather than client prices", async () => {
    const service = createPaperTradeMarketService(
      new MemoryPaperTradeRepository(),
      async () => snapshot,
      () => new Date("2026-07-29T03:01:00.000Z"),
    );

    await expect(service.createFromCurrentMarket("002472")).resolves.toMatchObject({
      entryPrice: 35.75,
      entryTradingDate: "2026-07-29",
      takeProfitPrice: 40,
      stopLossPrice: 32,
      isDemo: true,
    });
  });

  it("returns the latest server quote with the persisted paper trades", async () => {
    const repository = new MemoryPaperTradeRepository();
    const service = createPaperTradeMarketService(repository, async () => snapshot);
    await service.createFromCurrentMarket("002472");

    await expect(service.listAndSettle("002472")).resolves.toMatchObject({
      latestQuotePrice: 35.75,
      trades: [{ code: "002472", status: "open" }],
    });
  });

  it("manually closes an open trade with the server quote", async () => {
    const repository = new MemoryPaperTradeRepository();
    const service = createPaperTradeMarketService(
      repository,
      async () => snapshot,
      () => new Date("2026-07-29T03:01:00.000Z"),
    );
    const trade = await service.createFromCurrentMarket("002472");

    await expect(service.closeOpenById(trade.id)).resolves.toMatchObject({
      trade: {
        status: "manual_closed",
        exitPrice: 35.75,
        returnPercent: 0,
        settlementReason: "manual_closed",
      },
      statistics: { totalCount: 1, settledCount: 1, winRate: 0 },
    });
  });

  it("returns a filtered ledger and realized statistics", async () => {
    const repository = new MemoryPaperTradeRepository();
    const service = createPaperTradeMarketService(repository, async () => snapshot);
    const open = await service.createFromCurrentMarket("002472");
    repository.trades.push({
      ...open,
      id: "settled-1",
      status: "manual_closed",
      exitPrice: 39.33,
      exitTime: "2026-07-29T04:00:00.000Z",
      returnPercent: 10,
      settlementReason: "manual_closed",
    });

    await expect(service.listAllAndSettle("closed" satisfies PaperTradeListStatus, "returnPercent" satisfies PaperTradeSort)).resolves.toMatchObject({
      trades: [{ id: "settled-1", status: "manual_closed" }],
      statistics: { totalCount: 2, settledCount: 1, winRate: 100, totalReturnPercent: 10 },
    });
  });

  it("returns the latest server quote only for open ledger records", async () => {
    const repository = new MemoryPaperTradeRepository();
    const service = createPaperTradeMarketService(repository, async () => snapshot);
    const open = await service.createFromCurrentMarket("002472");
    repository.trades.push({
      ...open,
      id: "settled-1",
      status: "manual_closed",
      exitPrice: 36,
      exitTime: "2026-07-29T04:00:00.000Z",
      returnPercent: 0.7,
      settlementReason: "manual_closed",
    });

    await expect(service.listAllAndSettle("all", "entryTime")).resolves.toMatchObject({
      liveQuotesByTradeId: {
        [open.id]: { price: 35.75, marketTimestamp: snapshot.quote?.marketTimestamp, source: "tencent" },
      },
    });
  });

  it("keeps the ledger available when one open trade has no quote", async () => {
    const repository = new MemoryPaperTradeRepository();
    const service = createPaperTradeMarketService(repository, async (code) => {
      if (code === "000001") throw new Error("quote unavailable");
      return snapshot;
    });
    const open = await service.createFromCurrentMarket("002472");
    repository.trades.push({ ...open, id: "paper-no-quote", code: "000001" });

    await expect(service.listAllAndSettle("all", "entryTime")).resolves.toMatchObject({
      trades: [{ id: open.id }, { id: "paper-no-quote", status: "open" }],
      liveQuotesByTradeId: {
        [open.id]: { price: 35.75 },
        "paper-no-quote": null,
      },
    });
  });
});
