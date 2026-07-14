import { errorJson, marketDataJson } from "@/server/market-data/api-response";
import { MarketDataService } from "@/server/market-data/market-data-service";
import { assertAllowedStockCode, MarketDataError } from "@/server/market-data/market-data-errors";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawCodes = searchParams.get("codes");
    if (!rawCodes) throw new MarketDataError("MISSING_CODES", "缺少codes参数", 400);
    const codes = rawCodes
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);
    if (codes.length === 0) throw new MarketDataError("MISSING_CODES", "缺少codes参数", 400);
    if (codes.length > 50) throw new MarketDataError("TOO_MANY_CODES", "单次查询股票数量过多", 400);
    codes.forEach(assertAllowedStockCode);

    return marketDataJson(await new MarketDataService().getQuotes(codes));
  } catch (error) {
    return errorJson(error);
  }
}
