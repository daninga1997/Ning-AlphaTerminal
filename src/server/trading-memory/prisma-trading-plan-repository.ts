import type { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma-client";
import { mapEvent, mapPlan, mapReview } from "./trading-plan-mappers";
import { buildTradingPlanWhere, tradingPlanInclude, tradingPlanOrderBy } from "./trading-plan-query-builder";
import {
  buildCreatedEventData,
  buildPlanReviewUpsertData,
  buildSignalSnapshotCreateData,
  buildTradingPlanCreateData,
} from "./trading-plan-transaction-helpers";
import type {
  CreateTradingPlanInput,
  MemoryPlanFilters,
  PlanEventType,
  PlanReviewInput,
  TradingMemoryRepository,
  TradingPlanStatus,
} from "./trading-plan-repository";
import type { StockSignal } from "@/types/stock";

export class PrismaTradingPlanRepository implements TradingMemoryRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async createPlan(input: CreateTradingPlanInput) {
    const existing = await this.db.tradingPlan.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: tradingPlanInclude,
    });
    if (existing) return mapPlan(existing);

    const activeDuplicate =
      input.status === "active"
        ? await this.db.tradingPlan.findFirst({
            where: {
              planDate: input.planDate,
              code: input.code,
              planType: input.planType,
              status: "active",
              archivedAt: null,
            },
            include: tradingPlanInclude,
          })
        : null;
    if (activeDuplicate) return mapPlan(activeDuplicate);

    const plan = await this.db.$transaction(async (tx) => {
      const created = await tx.tradingPlan.create({
        data: buildTradingPlanCreateData(input),
      });

      await tx.signalSnapshot.create({
        data: buildSignalSnapshotCreateData(created.id, input),
      });

      await tx.planEvent.create({
        data: buildCreatedEventData(created.id, input.calculatedAt),
      });

      return tx.tradingPlan.findUniqueOrThrow({
        where: { id: created.id },
        include: tradingPlanInclude,
      });
    });

    return mapPlan(plan);
  }

  async findPlanById(id: string) {
    const plan = await this.db.tradingPlan.findFirst({
      where: { id, archivedAt: null },
      include: tradingPlanInclude,
    });
    return plan ? mapPlan(plan) : null;
  }

  async listPlans(filters: MemoryPlanFilters = {}) {
    const plans = await this.db.tradingPlan.findMany({
      where: buildTradingPlanWhere(filters),
      include: tradingPlanInclude,
      orderBy: tradingPlanOrderBy,
    });
    return plans.map(mapPlan);
  }

  async updatePlanStatus(id: string, status: TradingPlanStatus, finalSignal?: StockSignal) {
    const plan = await this.db.tradingPlan.update({
      where: { id },
      data: { status, finalSignal },
      include: tradingPlanInclude,
    });
    return mapPlan(plan);
  }

  async addEvent(input: {
    tradingPlanId: string;
    eventType: PlanEventType;
    eventTime?: string;
    price?: number | null;
    description: string;
    source?: string;
    metadata?: string;
  }) {
    const event = await this.db.planEvent.create({
      data: {
        tradingPlanId: input.tradingPlanId,
        eventType: input.eventType,
        eventTime: input.eventTime ? new Date(input.eventTime) : new Date(),
        price: input.price ?? null,
        description: input.description,
        source: input.source ?? "manual",
        metadata: input.metadata ?? "{}",
      },
    });
    return mapEvent(event);
  }

  async addReview(tradingPlanId: string, input: PlanReviewInput) {
    const upsertData = buildPlanReviewUpsertData(tradingPlanId, input);
    const review = await this.db.planReview.upsert({
      where: { tradingPlanId },
      update: upsertData.update,
      create: upsertData.create,
    });
    return mapReview(review);
  }
}
