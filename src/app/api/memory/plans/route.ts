import { analyzeStockFromMarketData } from "@/server/market-data/stock-analysis-service";
import { memoryError, memorySuccess } from "@/server/trading-memory/api-response";
import { PrismaTradingPlanRepository } from "@/server/trading-memory/prisma-trading-plan-repository";
import { buildPlanInputFromStock } from "@/server/trading-memory/stock-plan-factory";
import { createTradingMemoryService } from "@/server/trading-memory/trading-memory-service";
import type { CreateTradingPlanInput } from "@/server/trading-memory/trading-plan-repository";
import { TradingMemoryError } from "@/server/trading-memory/trading-memory-errors";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const plans = await new PrismaTradingPlanRepository().listPlans({
      query: searchParams.get("query") ?? undefined,
      date: searchParams.get("date") ?? undefined,
      sector: searchParams.get("sector") ?? undefined,
      planType: (searchParams.get("planType") as never) ?? undefined,
      status: (searchParams.get("status") as never) ?? undefined,
      outcome: (searchParams.get("outcome") as never) ?? undefined,
      marketDataMode: (searchParams.get("marketDataMode") as never) ?? undefined,
      reviewed: (searchParams.get("reviewed") as never) ?? undefined,
    });
    return memorySuccess(plans);
  } catch (error) {
    return memoryError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CreateTradingPlanInput> & {
      code?: string;
      planType?: "short_term" | "swing" | "mid_term";
      status?: "draft" | "active";
      idempotencyKey?: string;
    };
    const service = createTradingMemoryService(new PrismaTradingPlanRepository());
    const input = await resolvePlanInput(body);
    return memorySuccess(await service.createPlan(input), { status: 201 });
  } catch (error) {
    return memoryError(error);
  }
}

async function resolvePlanInput(
  body: Partial<CreateTradingPlanInput> & {
    code?: string;
    planType?: "short_term" | "swing" | "mid_term";
    status?: "draft" | "active";
    idempotencyKey?: string;
  },
): Promise<CreateTradingPlanInput> {
  if (body.snapshot && body.code && body.name && body.planDate) {
    return body as CreateTradingPlanInput;
  }
  if (!body.code) throw new TradingMemoryError("MISSING_CODE", "缺少股票代码", 400);

  const stock = await analyzeStockFromMarketData(body.code);
  if (!stock) throw new TradingMemoryError("STOCK_NOT_FOUND", "股票不存在", 404);
  return buildPlanInputFromStock(stock, {
    planType: body.planType,
    status: body.status,
    idempotencyKey: body.idempotencyKey,
  });
}
