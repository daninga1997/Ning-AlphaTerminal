import { errorResponse, paperTradeErrorResponse, paperTradeSuccess } from "@/server/paper-trading/paper-trade-api-response";
import { createRuntimePaperTradeService } from "@/server/paper-trading/paper-trade-runtime";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return errorResponse("INVALID_PAPER_TRADE_ID", 400);

  try {
    const trade = await createRuntimePaperTradeService().closeOpenById(id);
    return paperTradeSuccess(trade);
  } catch (error) {
    return paperTradeErrorResponse(error);
  }
}
