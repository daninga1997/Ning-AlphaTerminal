import { AppShell } from "@/components/layout/app-shell";
import { ReportsView } from "@/components/reports/reports-view";
import { mockReports } from "@/data/mock-reports";
import { IntegrityStatusBar } from "@/components/data-integrity/integrity-status-bar";
import { getLatestExpectedTradingDate } from "@/server/trading-calendar/trading-day-resolver";
import { getMarketDataMode } from "@/server/market-data/provider-registry";
import { buildStrategyWatchlist } from "@/server/strategy-engine/strategy-watchlist-service";

export default async function ReportsPage() {
  const mode = getMarketDataMode();
  const latestTradingDate = getLatestExpectedTradingDate(new Date());
  const strategyItems = await buildStrategyWatchlist().catch(() => []);

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <IntegrityStatusBar
          latestTradingDate={latestTradingDate}
          completenessPercent={0}
          status={mode === "live" ? "partial" : "demo_only"}
          permission="historical_only"
          canGenerateTradePlan={false}
        />
        <ReportsView reports={mockReports} strategyItems={strategyItems} />
      </div>
    </AppShell>
  );
}
