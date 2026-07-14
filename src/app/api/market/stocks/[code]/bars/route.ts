import { errorJson, marketDataJson } from "@/server/market-data/api-response";
import { MarketDataService } from "@/server/market-data/market-data-service";
import { assertAllowedStockCode, MarketDataError } from "@/server/market-data/market-data-errors";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    assertAllowedStockCode(code);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? "120d";
    if (period !== "120d") throw new MarketDataError("INVALID_PERIOD", "period参数无效", 400);
    return marketDataJson(await new MarketDataService().getDailyBars(code));
  } catch (error) {
    return errorJson(error);
  }
}
