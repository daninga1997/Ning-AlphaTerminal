import { strategyErrorJson } from "@/server/strategy-engine/strategy-errors";
import { buildStrategyWatchlist } from "@/server/strategy-engine/strategy-watchlist-service";

export async function GET() {
  try {
    const items = await buildStrategyWatchlist();

    return Response.json({
      success: true,
      data: items,
      meta: {
        count: items.length,
        calculatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return strategyErrorJson(error);
  }
}
