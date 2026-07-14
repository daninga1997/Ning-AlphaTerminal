import { memoryError, memorySuccess } from "@/server/trading-memory/api-response";
import { PrismaTradingPlanRepository } from "@/server/trading-memory/prisma-trading-plan-repository";
import { calculateTradingMemoryStats } from "@/server/trading-memory/trading-memory-stats";
import type { MarketDataMode } from "@/types/market-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get("mode") as MarketDataMode | null) ?? "mock";
    const plans = await new PrismaTradingPlanRepository().listPlans();
    return memorySuccess(calculateTradingMemoryStats(plans, { marketDataMode: mode }));
  } catch (error) {
    return memoryError(error);
  }
}
