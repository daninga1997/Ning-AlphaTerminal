import { NextResponse } from "next/server";
import { getLiveProviderConfig } from "@/server/market-data/providers/live/live-provider-config";
import { getMarketDataMode, getProvider } from "@/server/market-data/provider-registry";
import { errorJson } from "@/server/market-data/api-response";

export async function GET() {
  try {
    const mode = getMarketDataMode();
    const liveConfig = getLiveProviderConfig();
    const provider = getProvider(mode);
    const health = await provider.healthCheck();
    return NextResponse.json({
      success: true,
      data: {
        mode,
        providerName: health.source,
        health,
        capabilities: health.capabilities,
        delaySeconds: 0,
        isLicensedSource: health.capabilities.isLicensedSource,
        apiKeyConfigured: mode === "live" ? liveConfig.apiKeyConfigured : false,
      },
      meta: {
        source: health.source,
        status: health.ok ? "fresh" : "unavailable",
        marketTimestamp: null,
        receivedAt: new Date().toISOString(),
        isDemo: mode !== "live",
        mode,
      },
    });
  } catch (error) {
    return errorJson(error);
  }
}
