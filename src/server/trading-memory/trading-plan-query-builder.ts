import type { Prisma } from "@prisma/client";
import type { MemoryPlanFilters } from "./trading-plan-repository";

export const tradingPlanInclude = {
  events: true,
  review: true,
  snapshot: true,
} satisfies Prisma.TradingPlanInclude;

export const tradingPlanOrderBy = [{ createdAt: "desc" }] satisfies Prisma.TradingPlanOrderByWithRelationInput[];

export function buildTradingPlanWhere(filters: MemoryPlanFilters = {}): Prisma.TradingPlanWhereInput {
  const where: Prisma.TradingPlanWhereInput = { archivedAt: null };
  if (filters.date) where.planDate = filters.date;
  if (filters.sector && filters.sector !== "all") where.sector = filters.sector;
  if (filters.planType && filters.planType !== "all") where.planType = filters.planType;
  if (filters.status && filters.status !== "all") where.status = filters.status;
  if (filters.marketDataMode && filters.marketDataMode !== "all") where.marketDataMode = filters.marketDataMode;
  if (filters.query) {
    where.OR = [
      { code: { contains: filters.query } },
      { name: { contains: filters.query } },
      { sector: { contains: filters.query } },
    ];
  }
  if (filters.reviewed === "yes") where.review = { isNot: null };
  if (filters.reviewed === "no") where.review = { is: null };
  if (filters.outcome && filters.outcome !== "all") where.review = { is: { outcome: filters.outcome } };

  return where;
}
