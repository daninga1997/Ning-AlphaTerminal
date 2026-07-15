import { errorJson, marketDataJson } from "@/server/market-data/api-response";
import { MarketDataService } from "@/server/market-data/market-data-service";
import { parseMinuteRequest } from "@/server/market-data/minute-api-params";
import { ReplayMarketDataProvider } from "@/server/market-data/providers/replay/replay-market-data-provider";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const { searchParams } = new URL(request.url);
    const options = parseMinuteRequest(code, searchParams);
    const service =
      searchParams.get("mode") === "replay"
        ? new MarketDataService({ provider: new ReplayMarketDataProvider() })
        : new MarketDataService();
    return marketDataJson(await service.getMinuteBars(code, options));
  } catch (error) {
    return errorJson(error);
  }
}
