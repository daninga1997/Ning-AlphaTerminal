import { memoryError, memorySuccess } from "@/server/trading-memory/api-response";
import { TradingMemoryError } from "@/server/trading-memory/trading-memory-errors";
import { PrismaTradingPlanRepository } from "@/server/trading-memory/prisma-trading-plan-repository";
import { createTradingMemoryService } from "@/server/trading-memory/trading-memory-service";
import type { TradingPlanStatus } from "@/server/trading-memory/trading-plan-repository";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const plan = await createTradingMemoryService(new PrismaTradingPlanRepository()).getPlan(id);
    if (!plan) throw new TradingMemoryError("PLAN_NOT_FOUND", "交易计划不存在", 404);
    return memorySuccess(plan);
  } catch (error) {
    return memoryError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { status?: TradingPlanStatus; description?: string };
    if (!body.status) throw new TradingMemoryError("MISSING_STATUS", "缺少目标状态", 400);
    const plan = await createTradingMemoryService(new PrismaTradingPlanRepository()).transitionStatus(
      id,
      body.status,
      body.description ?? "状态更新",
    );
    return memorySuccess(plan);
  } catch (error) {
    return memoryError(error);
  }
}
