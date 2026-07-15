import { buildStrategyInputForCode, summarizeIntegrity } from "@/server/strategy-engine/strategy-input-builder";
import { runAllStrategies } from "@/server/strategy-engine/strategy-engine";
import { strategyErrorJson } from "@/server/strategy-engine/strategy-errors";
import type { StrategyQuery } from "@/server/strategy-engine/strategy-registry";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const { searchParams } = new URL(request.url);
    const strategy = (searchParams.get("strategy") ?? "all") as StrategyQuery;
    const input = await buildStrategyInputForCode(code);
    const output = runAllStrategies(input, { strategy });

    return Response.json({
      success: true,
      data: output,
      meta: {
        strategyVersion: input.strategyVersion,
        calculatedAt: input.calculatedAt,
        integrity: summarizeIntegrity(input.integrityReport),
      },
    });
  } catch (error) {
    return strategyErrorJson(error);
  }
}
