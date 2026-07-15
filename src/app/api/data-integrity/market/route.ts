import { NextResponse } from "next/server";
import { getLatestExpectedTradingDate, getTradingPhase } from "@/server/trading-calendar/trading-day-resolver";
import { getMarketDataMode, getProvider } from "@/server/market-data/provider-registry";
import type { DataIntegrityApiResponse } from "@/types/data-integrity";

export async function GET() {
  const now = new Date();
  const latestTradingDate = getLatestExpectedTradingDate(now);
  const phase = getTradingPhase(now);
  const mode = getMarketDataMode();
  let providerHealth: { source: string; ok: boolean } = { source: "unknown", ok: false };

  try {
    const provider = getProvider(mode);
    providerHealth = await provider.healthCheck();
  } catch {
    // ignore
  }

  const response: DataIntegrityApiResponse = {
    success: true,
    data: {
      status: mode === "live" ? (providerHealth.ok ? "partial" : "unavailable") : "demo_only",
      permission: mode === "live" ? "watch_only" : "historical_only",
      completenessPercent: mode === "live" ? 60 : 0,
      latestTradingDate,
      issues: mode === "live" && !providerHealth.ok
        ? [{ code: "PROVIDER_UNAVAILABLE", message: "行情服务不可用" }]
        : [],
      warnings: [],
      canGenerateTradePlan: mode === "live" && providerHealth.ok,
      canGenerateScore: mode === "live" || mode === "replay",
      canGenerateWatchZone: mode === "live",
      canGenerateEntryPrice: false,
      canGenerateBuySignal: false,
    },
    meta: {
      validatedAt: now.toISOString(),
      sources: { quote: providerHealth.source, daily: null, minute: null },
      mode,
    },
  };

  return NextResponse.json(response);
}