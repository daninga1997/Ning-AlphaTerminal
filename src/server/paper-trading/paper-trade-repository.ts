import type { PaperTrade, PrismaClient } from "@prisma/client";
import { prisma } from "../trading-memory/prisma-client";
import type { PaperTradeRecord, PaperTradeSettlement } from "./paper-trade-settlement";

export type CreatePaperTradeInput = Omit<
  PaperTradeRecord,
  "id" | "status" | "exitPrice" | "exitTime" | "returnPercent" | "settlementReason" | "createdAt" | "updatedAt"
>;

export interface PaperTradeRepository {
  createOpen(input: CreatePaperTradeInput): Promise<PaperTradeRecord>;
  findOpenByCode(code: string): Promise<PaperTradeRecord | null>;
  findById(id: string): Promise<PaperTradeRecord | null>;
  listByCode(code: string): Promise<PaperTradeRecord[]>;
  listOpen(): Promise<PaperTradeRecord[]>;
  listAll(): Promise<PaperTradeRecord[]>;
  settle(id: string, settlement: PaperTradeSettlement, exitTime: string): Promise<PaperTradeRecord>;
}

export class PrismaPaperTradeRepository implements PaperTradeRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async createOpen(input: CreatePaperTradeInput): Promise<PaperTradeRecord> {
    try {
      const trade = await this.db.paperTrade.create({
        data: {
          ...toCreateData(input),
          openKey: input.code,
        },
      });
      return mapPaperTrade(trade);
    } catch (error) {
      const existing = await this.findOpenByCode(input.code);
      if (existing) return existing;
      throw error;
    }
  }

  async findOpenByCode(code: string): Promise<PaperTradeRecord | null> {
    const trade = await this.db.paperTrade.findUnique({ where: { openKey: code } });
    return trade ? mapPaperTrade(trade) : null;
  }

  async findById(id: string): Promise<PaperTradeRecord | null> {
    const trade = await this.db.paperTrade.findUnique({ where: { id } });
    return trade ? mapPaperTrade(trade) : null;
  }

  async listByCode(code: string): Promise<PaperTradeRecord[]> {
    const trades = await this.db.paperTrade.findMany({ where: { code }, orderBy: { entryTime: "desc" } });
    return trades.map(mapPaperTrade);
  }

  async listOpen(): Promise<PaperTradeRecord[]> {
    const trades = await this.db.paperTrade.findMany({ where: { status: "open" }, orderBy: { entryTime: "asc" } });
    return trades.map(mapPaperTrade);
  }

  async listAll(): Promise<PaperTradeRecord[]> {
    const trades = await this.db.paperTrade.findMany({ orderBy: { entryTime: "desc" } });
    return trades.map(mapPaperTrade);
  }

  async settle(id: string, settlement: PaperTradeSettlement, exitTime: string): Promise<PaperTradeRecord> {
    const trade = await this.db.paperTrade.update({
      where: { id },
      data: {
        status: settlement.status,
        exitPrice: settlement.exitPrice,
        exitTime: new Date(exitTime),
        returnPercent: settlement.returnPercent,
        settlementReason: settlement.settlementReason,
        openKey: null,
      },
    });
    return mapPaperTrade(trade);
  }
}

function toCreateData(input: CreatePaperTradeInput) {
  return {
    code: input.code,
    name: input.name,
    sector: input.sector,
    entryPrice: input.entryPrice,
    entryTime: new Date(input.entryTime),
    entryTradingDate: input.entryTradingDate,
    takeProfitPrice: input.takeProfitPrice,
    stopLossPrice: input.stopLossPrice,
    marketDataSource: input.marketDataSource,
    marketTimestamp: new Date(input.marketTimestamp),
    isDemo: true,
  };
}

export function mapPaperTrade(trade: PaperTrade): PaperTradeRecord {
  return {
    id: trade.id,
    code: trade.code,
    name: trade.name,
    sector: trade.sector,
    entryPrice: trade.entryPrice,
    entryTime: trade.entryTime.toISOString(),
    entryTradingDate: trade.entryTradingDate,
    takeProfitPrice: trade.takeProfitPrice,
    stopLossPrice: trade.stopLossPrice,
    status: trade.status,
    exitPrice: trade.exitPrice,
    exitTime: trade.exitTime?.toISOString() ?? null,
    returnPercent: trade.returnPercent,
    settlementReason: trade.settlementReason,
    marketDataSource: trade.marketDataSource,
    marketTimestamp: trade.marketTimestamp.toISOString(),
    isDemo: trade.isDemo,
    createdAt: trade.createdAt.toISOString(),
    updatedAt: trade.updatedAt.toISOString(),
  };
}
