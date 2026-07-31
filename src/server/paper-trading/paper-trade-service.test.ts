import { beforeEach, describe, expect, it } from "vitest";
import { createPaperTradeService } from "./paper-trade-service";
import type { CreatePaperTradeInput, PaperTradeRepository } from "./paper-trade-repository";
import type { PaperTradeRecord, PaperTradeSettlement } from "./paper-trade-settlement";

class MemoryPaperTradeRepository implements PaperTradeRepository {
  trades: PaperTradeRecord[] = [];

  async createOpen(input: CreatePaperTradeInput): Promise<PaperTradeRecord> {
    const now = "2026-07-20T01:30:00.000Z";
    const trade: PaperTradeRecord = {
      id: `paper-${this.trades.length + 1}`,
      ...input,
      status: "open",
      exitPrice: null,
      exitTime: null,
      returnPercent: null,
      settlementReason: null,
      createdAt: now,
      updatedAt: now,
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
    const updated = {
      ...trade,
      ...settlement,
      exitTime,
      updatedAt: exitTime,
    };
    this.trades = this.trades.map((candidate) => candidate.id === id ? updated : candidate);
    return updated;
  }
}

const input: CreatePaperTradeInput = {
  code: "002472",
  name: "Shuanghuan Transmission",
  sector: "Robotics",
  entryPrice: 10,
  entryTime: "2026-07-20T01:30:00.000Z",
  entryTradingDate: "2026-07-20",
  takeProfitPrice: 12,
  stopLossPrice: 9,
  marketDataSource: "tencent",
  marketTimestamp: "2026-07-20T01:30:00.000Z",
  isDemo: true,
};

describe("paper trade service", () => {
  let repository: MemoryPaperTradeRepository;

  beforeEach(() => {
    repository = new MemoryPaperTradeRepository();
  });

  it("returns the existing open trade when the same stock is bought twice", async () => {
    const service = createPaperTradeService(repository);
    const first = await service.create(input);
    const second = await service.create(input);

    expect(second.id).toBe(first.id);
    expect(repository.trades).toHaveLength(1);
  });

  it("settles an open trade at the fifth completed trading-day close", async () => {
    const service = createPaperTradeService(repository);
    const created = await service.create(input);

    const settled = await service.settleOpenByCode("002472", {
      latestQuotePrice: 10.4,
      completedDailyBars: [
        { date: "2026-07-21", close: 10.1 },
        { date: "2026-07-22", close: 10.2 },
        { date: "2026-07-23", close: 10.3 },
        { date: "2026-07-24", close: 10.4 },
        { date: "2026-07-27", close: 10.5 },
      ],
      settledAt: "2026-07-27T07:00:00.000Z",
    });

    expect(settled).toMatchObject({ id: created.id, status: "expired", exitPrice: 10.5, returnPercent: 5 });
  });
});
