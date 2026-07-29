import { BacktestHistoryError, fetchBacktestHistory, parseBacktestHistoryRequest } from "../../../../lib/backtest/backtest-history";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const data = await fetchBacktestHistory(parseBacktestHistoryRequest(new URL(request.url)));
    return Response.json({ success: true, data });
  } catch (error) {
    if (error instanceof BacktestHistoryError) {
      return Response.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: error.statusCode },
      );
    }
    return Response.json(
      { success: false, error: { code: "BACKTEST_HISTORY_UNAVAILABLE", message: "历史日线暂时不可用" } },
      { status: 502 },
    );
  }
}
