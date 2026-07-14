import { memoryError, memorySuccess } from "@/server/trading-memory/api-response";
import { TradingMemoryError } from "@/server/trading-memory/trading-memory-errors";
import { PrismaTradingPlanRepository } from "@/server/trading-memory/prisma-trading-plan-repository";
import { createTradingMemoryService } from "@/server/trading-memory/trading-memory-service";
import type { PlanEventType } from "@/server/trading-memory/trading-plan-repository";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      eventType?: PlanEventType;
      description?: string;
      price?: number | null;
    };
    if (!body.eventType) throw new TradingMemoryError("MISSING_EVENT_TYPE", "缺少事件类型", 400);
    if (!body.description?.trim()) throw new TradingMemoryError("MISSING_DESCRIPTION", "缺少事件说明", 400);
    const event = await createTradingMemoryService(new PrismaTradingPlanRepository()).addEvent(
      id,
      body.eventType,
      body.description,
      body.price,
    );
    return memorySuccess(event, { status: 201 });
  } catch (error) {
    return memoryError(error);
  }
}
