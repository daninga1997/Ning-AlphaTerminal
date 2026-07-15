import { errorJson } from "@/server/market-data/api-response";
import { assertLocalSyncRequest } from "@/server/market-sync/local-api-guard";
import { MarketSyncService } from "@/server/market-sync/market-sync-service";

export async function POST(request: Request) {
  try {
    assertLocalSyncRequest(request);
    const body = await request.json().catch(() => ({}));
    const now = body.now ? new Date(body.now) : new Date();
    const result = await new MarketSyncService().finalizeTradingDay(now);
    return Response.json({ success: result.success, data: result });
  } catch (error) {
    return errorJson(error);
  }
}
