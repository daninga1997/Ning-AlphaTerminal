import { NextResponse } from "next/server";
import { errorJson } from "@/server/market-data/api-response";
import { MarketDataService } from "@/server/market-data/market-data-service";

export async function GET() {
  try {
    const data = await new MarketDataService().healthCheck();
    return NextResponse.json({
      success: true,
      data,
      meta: {
        source: data.source,
        status: data.ok ? "fresh" : "unavailable",
        marketTimestamp: null,
        receivedAt: new Date().toISOString(),
        isDemo: data.mode === "mock",
      },
    });
  } catch (error) {
    return errorJson(error);
  }
}
