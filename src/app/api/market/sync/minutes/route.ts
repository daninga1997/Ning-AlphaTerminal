import { errorJson } from "@/server/market-data/api-response";
import { assertLocalSyncRequest } from "@/server/market-sync/local-api-guard";
import { MarketSyncService } from "@/server/market-sync/market-sync-service";

export async function POST(request: Request) {
  try {
    assertLocalSyncRequest(request);
    const body = await request.json().catch(() => ({}));
    const summary = await new MarketSyncService().syncMinuteBars(body);
    return Response.json({ success: summary.success, data: summary });
  } catch (error) {
    return errorJson(error);
  }
}
