import { errorJson, marketDataJson } from "@/server/market-data/api-response";
import { MarketDataService } from "@/server/market-data/market-data-service";
import { assertAllowedStockCode } from "@/server/market-data/market-data-errors";

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    assertAllowedStockCode(code);
    return marketDataJson(await new MarketDataService().getQuote(code));
  } catch (error) {
    return errorJson(error);
  }
}
