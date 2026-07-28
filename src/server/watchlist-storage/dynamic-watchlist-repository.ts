/**
 * 动态观察池 Prisma 存储层
 *
 * 提供 UPSERT + 查询能力，使用 Prisma 保证原子性和幂等。
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type DynamicWatchlistEntry = {
  code: string;
  name: string;
  source: "strategy_auto_join";
  firstAddedAt: string;
  lastAnalyzedAt: string;
  lastAction: string;
  dataBlockers: string[];
  lastConclusion: string;
  lastAnalysisDate: string;
  signalValidUntil: string;
};

export async function getAllDynamicEntries(): Promise<DynamicWatchlistEntry[]> {
  const rows = await prisma.dynamicWatchlistEntry.findMany({
    orderBy: { lastAnalyzedAt: "desc" },
  });

  return rows.map((row) => ({
    code: row.stockCode,
    name: row.stockName,
    source: "strategy_auto_join" as const,
    firstAddedAt: row.firstAddedAt.toISOString(),
    lastAnalyzedAt: row.lastAnalyzedAt.toISOString(),
    lastAction: row.lastStrategyAction,
    dataBlockers: row.dataIntegrityStatus === "BLOCKED" ? ["DATA_BLOCKED"] : [],
    lastConclusion: row.latestConclusion ?? "",
    lastAnalysisDate: row.lastAnalyzedAt.toISOString().split("T")[0],
    signalValidUntil: row.signalValidUntil.toISOString().split("T")[0],
  }));
}

export async function getEntryCount(): Promise<number> {
  return prisma.dynamicWatchlistEntry.count();
}

export async function upsertDynamicEntry(entry: {
  code: string;
  name: string;
  lastAction: string;
  dataBlockers: string[];
  lastConclusion: string;
  lastAnalysisDate: string;
  signalValidUntil: string;
}): Promise<DynamicWatchlistEntry> {
  const row = await prisma.dynamicWatchlistEntry.upsert({
    where: {
      stockCode_sourceType: {
        stockCode: entry.code,
        sourceType: "DYNAMIC",
      },
    },
    create: {
      stockCode: entry.code,
      stockName: entry.name,
      sourceType: "DYNAMIC",
      triggerStrategy: "combined",
      lastStrategyAction: entry.lastAction,
      dataIntegrityStatus: entry.dataBlockers.length > 0 ? "BLOCKED" : "READY",
      latestConclusion: entry.lastConclusion,
      signalValidUntil: new Date(entry.signalValidUntil),
    },
    update: {
      stockName: entry.name,
      triggerStrategy: "combined",
      lastStrategyAction: entry.lastAction,
      dataIntegrityStatus: entry.dataBlockers.length > 0 ? "BLOCKED" : "READY",
      latestConclusion: entry.lastConclusion,
      signalValidUntil: new Date(entry.signalValidUntil),
      lastAnalyzedAt: new Date(),
    },
  });

  return {
    code: row.stockCode,
    name: row.stockName,
    source: "strategy_auto_join",
    firstAddedAt: row.firstAddedAt.toISOString(),
    lastAnalyzedAt: row.lastAnalyzedAt.toISOString(),
    lastAction: row.lastStrategyAction,
    dataBlockers: row.dataIntegrityStatus === "BLOCKED" ? ["DATA_BLOCKED"] : [],
    lastConclusion: row.latestConclusion ?? "",
    lastAnalysisDate: row.lastAnalyzedAt.toISOString().split("T")[0],
    signalValidUntil: row.signalValidUntil.toISOString().split("T")[0],
  };
}