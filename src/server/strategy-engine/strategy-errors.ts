export class StrategyEngineError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 422,
  ) {
    super(message);
    this.name = "StrategyEngineError";
  }
}

export function strategyErrorJson(error: unknown) {
  if (error instanceof StrategyEngineError) {
    return Response.json({ success: false, error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return Response.json({ success: false, error: { code: "STRATEGY_ENGINE_ERROR", message: "策略引擎计算失败" } }, { status: 500 });
}
