import type { Report, ReportDataStatus, ReportSector, ReportStock, ReportType } from "@/types/report";
import type { MarketOverview, SectorSnapshot } from "@/types/market-data";
import { mockReports } from "@/data/mock-reports";
import { MarketDataService } from "@/server/market-data/market-data-service";
import { getMarketDataMode } from "@/server/market-data/provider-registry";
import { suggestedPositionUpperBound } from "@/server/market-sync/market-overview-scoring";
import { coreSectorMappings } from "@/server/market-sync/sector-mapping";
import { getTradingPhase } from "@/server/trading-calendar/trading-day-resolver";
import { buildStrategyWatchlist, type StrategyWatchlistItem } from "@/server/strategy-engine/strategy-watchlist-service";

export type DailyBriefingResult = {
  reports: Report[];
  strategyItems: StrategyWatchlistItem[];
};

// 盘前/盘中/盘后简报：由策略引擎与行情服务实时生成，失败时回退到演示报告
export async function buildDailyBriefing(): Promise<DailyBriefingResult> {
  try {
    const strategyItems = await buildStrategyWatchlist();
    const service = new MarketDataService();
    const [overviewResult, sectorResult] = await Promise.all([
      service.getMarketOverview(),
      service.getSectorSnapshots(),
    ]);
    const report = buildBriefingReport(
      strategyItems,
      overviewResult.success ? overviewResult.data : null,
      sectorResult.success ? sectorResult.data : [],
    );
    return { reports: [report], strategyItems };
  } catch {
    return { reports: mockReports, strategyItems: [] };
  }
}

function buildBriefingReport(
  items: StrategyWatchlistItem[],
  overview: MarketOverview | null,
  sectors: SectorSnapshot[],
): Report {
  const mode = getMarketDataMode();
  const phase = getTradingPhase(new Date());
  const type = reportTypeFromPhase(phase);
  const marketScore = overview?.marketScore ?? 0;
  const rankedStocks: ReportStock[] = items
    .map((item) => {
      const plan = item.finalPlan;
      const primary = item.strategies.find((strategy) => strategy.strategyId === plan.primaryStrategy);
      const signal = signalFromAction(plan.currentAction);
      return {
        code: plan.code,
        name: plan.name,
        sector: item.sectorIds[0] ? sectorNameOf(item.sectorIds[0]) : "未分类",
        level: levelFromGrade(plan.grade, signal),
        signal,
        score: primary?.totalScore ?? 0,
        trigger: plan.triggerConditions[0] ?? "等待数据完整后确认",
        chaseLimit: `放弃追高 ${plan.chaseLimit.price.toFixed(2)}`,
        summary: `${plan.marketState}；${plan.sectorState}。`,
      };
    })
    .sort((a, b) => b.score - a.score);
  const reportSectors: ReportSector[] = [...sectors]
    .sort((a, b) => b.strengthScore - a.strengthScore)
    .slice(0, 5)
    .map((sector, index) => ({
      name: sector.name,
      rank: index + 1,
      heat: sector.strengthScore,
      summary: `${sector.name} 板块强度 ${sector.strengthScore}。`,
    }));
  const risks = Array.from(
    new Set(items.flatMap((item) => [...item.finalPlan.warnings, ...item.finalPlan.invalidReasons])),
  ).slice(0, 5);
  const actionPlan = Array.from(
    new Set(items.flatMap((item) => [...item.finalPlan.exitRules, ...item.finalPlan.cancellationConditions])),
  ).slice(0, 5);
  const advancing = overview?.advancingCount ?? 0;
  const total = (overview?.advancingCount ?? 0) + (overview?.decliningCount ?? 0) + (overview?.unchangedCount ?? 0);
  const topSector = reportSectors[0];
  const isDemo = mode === "mock" || items.some((item) => item.finalPlan.isDemoPlan);
  const titles: Record<ReportType, string> = {
    premarket: "盘前简报：今日观察与风险清单",
    intraday: "盘中简报：实时策略信号",
    postmarket: "盘后简报：执行回顾与明日关注",
  };

  return {
    id: `${type}-${new Date().toISOString().slice(0, 10)}`,
    type,
    title: titles[type],
    reportDate: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    marketStatus: items[0]?.finalPlan.marketState ?? "数据不足",
    marketScore,
    suggestedPosition: suggestedPositionUpperBound(
      marketScore,
      overview?.status === "fresh" || overview?.status === "delayed",
    ),
    marketSummary:
      total > 0
        ? `${advancing}/${total} 只上涨${topSector ? `，主线：${topSector.name}` : ""}。`
        : "当前市场概览数据不完整，仓位上限保持保守。",
    sectors: reportSectors,
    stocks: rankedStocks,
    risks,
    actionPlan,
    dataStatus: dataStatusFromIntegrity(items[0]?.integrity.status ?? "unavailable"),
    isDemo,
  };
}

function reportTypeFromPhase(phase: string): ReportType {
  if (phase === "premarket") return "premarket";
  if (phase === "auction" || phase === "morning" || phase === "lunch_break" || phase === "afternoon") return "intraday";
  return "postmarket";
}

function signalFromAction(action: string): ReportStock["signal"] {
  if (action === "buy_allowed") return "buy";
  if (action === "hold") return "hold";
  if (action === "reduce") return "reduce";
  if (action === "avoid") return "avoid";
  return "wait";
}

function levelFromGrade(grade: string, signal: ReportStock["signal"]): ReportStock["level"] {
  if (signal === "avoid" || signal === "reduce") return "Risk";
  if (grade === "S" || grade === "A") return "A";
  if (grade === "B") return "B";
  return "Watch";
}

function sectorNameOf(sectorId: string): string {
  return coreSectorMappings.find((mapping) => mapping.sectorId === sectorId)?.sectorName ?? "未分类";
}

function dataStatusFromIntegrity(status: string): ReportDataStatus {
  if (status === "complete") return "fresh";
  if (status === "partial" || status === "demo_only") return "delayed";
  if (status === "stale") return "stale";
  return "unavailable";
}
