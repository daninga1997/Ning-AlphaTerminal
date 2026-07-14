import { NextResponse } from "next/server";
import { memoryError } from "@/server/trading-memory/api-response";
import { PrismaTradingPlanRepository } from "@/server/trading-memory/prisma-trading-plan-repository";
import { buildMemoryCsv, buildMemoryJsonExport } from "@/server/trading-memory/trading-memory-export";
import { TradingMemoryError } from "@/server/trading-memory/trading-memory-errors";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";
    const plans = await new PrismaTradingPlanRepository().listPlans();
    const date = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      return new NextResponse(buildMemoryJsonExport(plans), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="alpha-memory-${date}.json"`,
        },
      });
    }

    if (format === "csv") {
      return new NextResponse(buildMemoryCsv(plans), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="alpha-memory-${date}.csv"`,
        },
      });
    }

    throw new TradingMemoryError("UNSUPPORTED_EXPORT_FORMAT", "不支持的导出格式", 400);
  } catch (error) {
    return memoryError(error);
  }
}
