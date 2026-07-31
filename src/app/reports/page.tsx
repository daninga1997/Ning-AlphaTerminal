import { AppShell } from "@/components/layout/app-shell";
import { ReportsView } from "@/components/reports/reports-view";
import { IntegrityStatusBar } from "@/components/data-integrity/integrity-status-bar";
import { getLatestExpectedTradingDate } from "@/server/trading-calendar/trading-day-resolver";
import { getMarketDataMode } from "@/server/market-data/provider-registry";
import { buildDailyBriefing } from "@/server/reports/daily-briefing";

export default async function ReportsPage() {
  const mode = getMarketDataMode();
  const latestTradingDate = getLatestExpectedTradingDate(new Date());
  const { reports, strategyItems } = await buildDailyBriefing();

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <IntegrityStatusBar
          latestTradingDate={latestTradingDate}
          completenessPercent={0}
          status={mode === "live" ? "partial" : "unavailable"}
          permission="historical_only"
          canGenerateTradePlan={false}
        />
        <ReportsView reports={reports} strategyItems={strategyItems} />
      </div>
    </AppShell>
  );
}
