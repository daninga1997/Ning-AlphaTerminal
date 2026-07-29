import type { StockAnalysis } from "@/types/stock";
import type { DataCapabilityMatrix } from "../../server/market-data/capability-matrix";
import type { DataIntegrityReport } from "@/types/data-integrity";
import { getOpportunities, getTopStocks } from "../../lib/stock-ranking";
import { DashboardAssistant } from "./dashboard-assistant";
import { getHotSectors } from "./dashboard-view-model";
import { HotSectors } from "./hot-sectors";
import { MarketOverview } from "./market-overview";
import { QuickWatchlist } from "./quick-watchlist";
import { TodayDecision } from "./today-decision";
import { TodayWatch } from "./today-watch";
import { IntegrityStatusBar } from "../data-integrity/integrity-status-bar";

export { DashboardAssistant };

export function Dashboard({
  capabilityMatrix,
  stocks,
  integrityReport,
}: {
  capabilityMatrix?: DataCapabilityMatrix;
  stocks: StockAnalysis[];
  integrityReport?: DataIntegrityReport | null;
}) {
  const opportunities = getOpportunities(stocks);
  const hotSectors = getHotSectors(stocks);
  const topStocks = getTopStocks(stocks, "totalScore", 10);
  const aLevelStock = opportunities.aLevel[0];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
      {integrityReport ? (
        <IntegrityStatusBar
          latestTradingDate={integrityReport.latestTradingDate}
          completenessPercent={integrityReport.completenessPercent}
          status={integrityReport.status}
          permission={integrityReport.permission}
          canGenerateTradePlan={integrityReport.canGenerateTradePlan}
          quoteTimestamp={integrityReport.marketTimestamp}
          quoteSource={integrityReport.quoteSource}
        />
      ) : null}
      <MarketOverview capabilityMatrix={capabilityMatrix} stocks={stocks} />
      <TodayDecision stock={aLevelStock} canGenerateFullPlan={integrityReport?.canGenerateTradePlan ?? false} />
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <TodayWatch stocks={opportunities.bLevel} />
        <HotSectors sectors={hotSectors} />
      </div>
      <QuickWatchlist stocks={topStocks} />
    </div>
  );
}
