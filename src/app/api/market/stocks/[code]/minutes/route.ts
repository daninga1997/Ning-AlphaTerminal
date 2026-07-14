import { errorJson, marketDataJson } from "@/server/market-data/api-response";
import { MarketDataService } from "@/server/market-data/market-data-service";
import { parseMinuteRequest } from "@/server/market-data/minute-api-params";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const { searchParams } = new URL(request.url);
    const options = parseMinuteRequest(code, searchParams);
    return marketDataJson(await new MarketDataService().getMinuteBars(code, options));
  } catch (error) {
    return errorJson(error);
  }
}
