"use client";

import { useMemo, useState } from "react";
import type { Report, ReportType } from "@/types/report";
import { getLatestReport, getReportsByType, getSortedReports } from "@/lib/reports/report-utils";
import { ActionPlanSection } from "./action-plan-section";
import { MarketOverviewSection } from "./market-overview-section";
import { ReportHistoryList } from "./report-history-list";
import { ReportRiskSection } from "./report-risk-section";
import { ReportStockSection } from "./report-stock-section";
import { ReportSummary } from "./report-summary";
import { ReportTabs } from "./report-tabs";
import { ReportsHeader } from "./reports-header";
import { SectorRankingSection } from "./sector-ranking-section";
import { ReportsStrategySection } from "../strategy/strategy-plan-panel";
import type { StrategyWatchlistItem } from "@/server/strategy-engine/strategy-watchlist-service";

export function ReportsView({ reports, strategyItems = [] }: { reports: Report[]; strategyItems?: StrategyWatchlistItem[] }) {
  const initialReport = getLatestReport(reports);
  const [activeType, setActiveType] = useState<ReportType>(initialReport.type);
  const [activeReportId, setActiveReportId] = useState(initialReport.id);

  const sortedReports = useMemo(() => getSortedReports(reports), [reports]);
  const reportsForType = useMemo(() => getReportsByType(reports, activeType), [activeType, reports]);
  const activeReport =
    sortedReports.find((report) => report.id === activeReportId && report.type === activeType) ??
    reportsForType[0] ??
    initialReport;

  function handleTypeChange(type: ReportType) {
    const nextReport = getReportsByType(reports, type)[0];
    setActiveType(type);
    if (nextReport) setActiveReportId(nextReport.id);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
      <ReportsHeader report={activeReport} totalCount={reports.length} />
      <ReportTabs activeType={activeType} onChange={handleTypeChange} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <ReportSummary report={activeReport} />
          {strategyItems.length > 0 ? <ReportsStrategySection items={strategyItems} /> : null}
          <MarketOverviewSection report={activeReport} />
          <SectorRankingSection sectors={activeReport.sectors} />
          <ReportStockSection report={activeReport} />
          <ReportRiskSection risks={activeReport.risks} />
          <ActionPlanSection report={activeReport} />
        </div>
        <ReportHistoryList
          activeId={activeReport.id}
          onSelect={(report) => {
            setActiveType(report.type);
            setActiveReportId(report.id);
          }}
          reports={reportsForType}
        />
      </div>
    </div>
  );
}
