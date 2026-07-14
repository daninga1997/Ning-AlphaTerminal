import type { StockSignal } from "@/types/stock";
import { TradingMemoryError, assertFound } from "./trading-memory-errors";
import type {
  CreateTradingPlanInput,
  PlanEventType,
  PlanReviewInput,
  TradingMemoryRepository,
  TradingPlanStatus,
} from "./trading-plan-repository";

const allowedTransitions: Record<TradingPlanStatus, TradingPlanStatus[]> = {
  draft: ["active", "cancelled"],
  active: ["triggered", "cancelled", "invalidated", "expired"],
  triggered: ["completed", "invalidated"],
  cancelled: [],
  invalidated: [],
  completed: [],
  expired: [],
};

const transitionEvents: Partial<Record<TradingPlanStatus, PlanEventType>> = {
  active: "activated",
  triggered: "entry_zone_touched",
  cancelled: "cancelled",
  invalidated: "invalidated",
  completed: "completed",
  expired: "manual_note",
};

export function getAllowedStatusTransitions(status: TradingPlanStatus) {
  return allowedTransitions[status];
}

export function isTerminalStatus(status: TradingPlanStatus) {
  return allowedTransitions[status].length === 0;
}

export function calculateReviewMetrics(input: {
  entryPrice?: number | null;
  exitPrice?: number | null;
  highestPrice?: number | null;
  lowestPrice?: number | null;
}) {
  const entry = input.entryPrice ?? 0;
  const safePercent = (value?: number | null) => {
    if (!entry || value === null || value === undefined) return 0;
    const result = ((value - entry) / entry) * 100;
    return Number.isFinite(result) ? Number(Number(result).toFixed(2)) : 0;
  };

  return {
    returnPercent: safePercent(input.exitPrice),
    maxFavorableExcursionPercent: safePercent(input.highestPrice),
    maxAdverseExcursionPercent: safePercent(input.lowestPrice),
  };
}

export function createTradingMemoryService(repository: TradingMemoryRepository) {
  const validateCreateInput = (input: CreateTradingPlanInput) => {
    if (!input.code.trim()) throw new TradingMemoryError("INVALID_CODE", "股票代码不能为空", 400);
    if (!input.idempotencyKey.trim()) throw new TradingMemoryError("INVALID_IDEMPOTENCY_KEY", "缺少幂等键", 400);
    if (input.snapshot.dataStatus === "unavailable" && input.status === "active") {
      throw new TradingMemoryError("UNAVAILABLE_ACTIVE_PLAN", "不可用数据不能创建 active 计划", 400);
    }
    if (input.snapshot.dataStatus === "stale" && input.status !== "draft") {
      throw new TradingMemoryError("STALE_REQUIRES_DRAFT", "延迟数据只能保存为 draft", 400);
    }
    if (input.invalidReason && input.status === "active") {
      throw new TradingMemoryError("INVALID_PLAN_ACTIVE", "失效计划不能创建 active", 400);
    }
    if ((input.marketDataMode === "mock" || input.marketDataMode === "replay") && !input.isDemo) {
      throw new TradingMemoryError("DEMO_FLAG_REQUIRED", "Mock/Replay计划必须标记为演示", 400);
    }
  };

  return {
    async createPlan(input: CreateTradingPlanInput) {
      validateCreateInput(input);
      return repository.createPlan(input);
    },

    async listPlans() {
      return repository.listPlans();
    },

    async getPlan(id: string) {
      const plan = await repository.findPlanById(id);
      if (!plan) return null;
      return {
        ...plan,
        events: [...plan.events].sort((a, b) => a.eventTime.localeCompare(b.eventTime)),
      };
    },

    async transitionStatus(id: string, nextStatus: TradingPlanStatus, description: string) {
      const current = assertFound(await repository.findPlanById(id));
      if (isTerminalStatus(current.status)) {
        throw new TradingMemoryError("TERMINAL_STATUS", "终态计划不能重新激活", 400);
      }
      if (!allowedTransitions[current.status].includes(nextStatus)) {
        throw new TradingMemoryError("INVALID_STATUS_TRANSITION", "非法状态转换", 400);
      }

      const finalSignal: StockSignal =
        nextStatus === "cancelled" || nextStatus === "invalidated" || nextStatus === "expired"
          ? "avoid"
          : current.finalSignal;
      const updated = assertFound(await repository.updatePlanStatus(id, nextStatus, finalSignal));
      await repository.addEvent({
        tradingPlanId: id,
        eventType: transitionEvents[nextStatus] ?? "manual_note",
        description,
        source: "system",
      });
      return updated;
    },

    async addEvent(id: string, eventType: PlanEventType, description: string, price?: number | null) {
      assertFound(await repository.findPlanById(id));
      return repository.addEvent({
        tradingPlanId: id,
        eventType,
        description,
        price,
        source: "manual",
      });
    },

    async addReview(id: string, input: PlanReviewInput) {
      const plan = assertFound(await repository.findPlanById(id));
      if (!["completed", "cancelled", "invalidated", "expired"].includes(plan.status)) {
        throw new TradingMemoryError("REVIEW_NOT_ALLOWED", "只有终态计划允许复盘", 400);
      }
      const metrics = calculateReviewMetrics(input);
      return repository.addReview(id, { ...input, ...metrics });
    },

    async getStats() {
      return repository.listPlans();
    },
  };
}

export type TradingMemoryService = ReturnType<typeof createTradingMemoryService>;
