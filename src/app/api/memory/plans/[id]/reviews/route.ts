import { memoryError, memorySuccess } from "@/server/trading-memory/api-response";
import { TradingMemoryError } from "@/server/trading-memory/trading-memory-errors";
import { PrismaTradingPlanRepository } from "@/server/trading-memory/prisma-trading-plan-repository";
import { createTradingMemoryService } from "@/server/trading-memory/trading-memory-service";
import type { PlanReviewInput } from "@/server/trading-memory/trading-plan-repository";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Partial<PlanReviewInput>;
    if (!body.reviewDate) throw new TradingMemoryError("MISSING_REVIEW_DATE", "缺少复盘日期", 400);
    if (!body.outcome) throw new TradingMemoryError("MISSING_OUTCOME", "缺少复盘结果", 400);
    const review = await createTradingMemoryService(new PrismaTradingPlanRepository()).addReview(
      id,
      normalizeReviewInput(body),
    );
    return memorySuccess(review, { status: 201 });
  } catch (error) {
    return memoryError(error);
  }
}

function normalizeReviewInput(input: Partial<PlanReviewInput>): PlanReviewInput {
  return {
    reviewDate: input.reviewDate!,
    outcome: input.outcome!,
    entryPrice: input.entryPrice ?? null,
    exitPrice: input.exitPrice ?? null,
    highestPrice: input.highestPrice ?? null,
    lowestPrice: input.lowestPrice ?? null,
    holdingDays: input.holdingDays ?? 0,
    followedPlan: input.followedPlan ?? false,
    executionNotes: input.executionNotes ?? "",
    whatWorked: input.whatWorked ?? "",
    whatFailed: input.whatFailed ?? "",
    lesson: input.lesson ?? "",
    isDemo: input.isDemo ?? true,
  };
}
