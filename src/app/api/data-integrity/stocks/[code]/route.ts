import { NextResponse } from "next/server";
import type { StrategyType, DataIntegrityApiResponse } from "@/types/data-integrity";
import { getMarketDataMode } from "@/server/market-data/provider-registry";
import { MarketDataService } from "@/server/market-data/market-data-service";
import { buildIntegrityReport } from "@/server/data-integrity/validators/integrity-report-builder";
import { resolveTradeDecisionPermission } from "@/server/data-integrity/permission-matrix";
import { getLatestExpectedTradingDate } from "@/server/trading-calendar/trading-day-resolver";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const url = new URL(request.url);
  const strategyParam = url.searchParams.get("strategy") as StrategyType | null;
  const mode = getMarketDataMode();
  const service = new MarketDataService();

  const now = new Date();
  const latestTradingDate = getLatestExpectedTradingDate(now);

  try {
    const [quoteResult, barsResult] = await Promise.all([
      service.getQuote(code),
      service.getDailyBars(code),
    ]);

    const quote = quoteResult.success ? quoteResult.data : null;
    const dailyBars = barsResult.success ? barsResult.data : null;

    const report = buildIntegrityReport({
      code,
      mode,
      quote,
      dailyBars,
      minuteBars: null,
      sectors: null,
      marketOverview: null,
    });

    const strategy: StrategyType = strategyParam ?? "generic_short_term";
    const permission = resolveTradeDecisionPermission(report, strategy);

    const response: DataIntegrityApiResponse = {
      success: true,
      data: {
        status: report.status,
        permission,
        completenessPercent: report.completenessPercent,
        latestTradingDate: report.latestTradingDate,
        issues: report.issues.map((i) => ({ code: i.code, message: i.message })),
        warnings: report.warnings.map((w) => ({ code: w.code, message: w.message })),
        canGenerateTradePlan: report.canGenerateTradePlan,
        canGenerateScore: report.canGenerateScore,
        canGenerateWatchZone: report.canGenerateWatchZone,
        canGenerateEntryPrice: report.canGenerateEntryPrice,
        canGenerateBuySignal: report.canGenerateBuySignal,
      },
      meta: {
        validatedAt: now.toISOString(),
        sources: {
          quote: report.quoteSource,
          daily: report.dailySource,
          minute: report.minuteSource,
        },
        mode,
      },
    };

    return NextResponse.json(response);
  } catch {
    const response: DataIntegrityApiResponse = {
      success: true,
      data: {
        status: "unavailable",
        permission: "blocked",
        completenessPercent: 0,
        latestTradingDate,
        issues: [{ code: "PROVIDER_UNAVAILABLE", message: "行情数据服务异常" }],
        warnings: [],
        canGenerateTradePlan: false,
        canGenerateScore: false,
        canGenerateWatchZone: false,
        canGenerateEntryPrice: false,
        canGenerateBuySignal: false,
      },
      meta: {
        validatedAt: now.toISOString(),
        sources: { quote: null, daily: null, minute: null },
        mode,
      },
    };

    return NextResponse.json(response);
  }
}