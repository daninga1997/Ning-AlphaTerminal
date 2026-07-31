import { createRuntimePaperTradeService } from "@/server/paper-trading/paper-trade-runtime";
import { parsePaperTradeListParams } from "@/server/paper-trading/paper-trade-list-params";
import { errorResponse, paperTradeErrorResponse, paperTradeSuccess } from "@/server/paper-trading/paper-trade-api-response";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const code = searchParams.get("code");

  try {
    const service = createRuntimePaperTradeService();
    if (code) {
      if (!/^\d{6}$/.test(code)) return errorResponse("INVALID_PAPER_TRADE_CODE", 400);
      return paperTradeSuccess(await service.listAndSettle(code));
    }

    const { status, sort } = parsePaperTradeListParams(searchParams);
    return paperTradeSuccess(await service.listAllAndSettle(status, sort));
  } catch (error) {
    return paperTradeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) return errorResponse("INVALID_PAPER_TRADE_CODE", 400);

  try {
    const trade = await createRuntimePaperTradeService().createFromCurrentMarket(code);
    return paperTradeSuccess(trade, { status: 201 });
  } catch (error) {
    return paperTradeErrorResponse(error);
  }
}
