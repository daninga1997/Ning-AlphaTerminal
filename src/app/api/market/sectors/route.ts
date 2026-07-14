import { marketDataJson } from "@/server/market-data/api-response";
import { MarketDataService } from "@/server/market-data/market-data-service";

export async function GET() {
  return marketDataJson(await new MarketDataService().getSectorSnapshots());
}
