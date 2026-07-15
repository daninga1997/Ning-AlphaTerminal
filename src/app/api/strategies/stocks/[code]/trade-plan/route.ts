import { buildStrategyInputForCode, summarizeIntegrity } from "@/server/strategy-engine/strategy-input-builder";
import { runAllStrategies } from "@/server/strategy-engine/strategy-engine";
import { strategyErrorJson } from "@/server/strategy-engine/strategy-errors";

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const input = await buildStrategyInputForCode(code);
    const output = runAllStrategies(input);

    if (!input.integrityReport.canGenerateTradePlan) {
      return Response.json(
        {
          success: false,
          error: {
            code: "DATA_PERMISSION_NOT_FULL",
            message: "数据权限不足，只生成观察结论，不生成正式交易计划",
          },
          data: output,
          meta: {
            integrity: summarizeIntegrity(input.integrityReport),
            strategyVersion: input.strategyVersion,
          },
        },
        { status: 422 },
      );
    }

    return Response.json({
      success: true,
      data: {
        status: "draft",
        autoSaved: false,
        output,
      },
      meta: {
        strategyVersion: input.strategyVersion,
        integrity: summarizeIntegrity(input.integrityReport),
      },
    }, { status: 201 });
  } catch (error) {
    return strategyErrorJson(error);
  }
}
