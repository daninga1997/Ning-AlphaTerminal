import { MarketDataService } from "@/server/market-data/market-data-service";
import { watchlistCodes } from "@/server/market-sync/sector-mapping";
import { PrismaMarketDataRepository } from "@/server/market-storage/prisma-market-data-repository";
import { buildStrategyInputForCode, loadStrategySharedMarketContext, summarizeIntegrity } from "./strategy-input-builder";
import { runAllStrategies } from "./strategy-engine";
import type { StrategyResult } from "./types/strategy-result";
import type { StrategyTradePlan } from "./types/trade-plan";

export interface StrategyWatchlistItem {
  code: string;
  name: string;
  sectorIds: string[];
  finalPlan: StrategyTradePlan;
  strategies: StrategyResult[];
  conflicts: string[];
  integrity: ReturnType<typeof summarizeIntegrity>;
}

export async function buildStrategyWatchlist(): Promise<StrategyWatchlistItem[]> {
  const service = new MarketDataService();
  const repository = new PrismaMarketDataRepository();
  const quotesResult = await service.getQuotes(watchlistCodes);
  const quotes = new Map(quotesResult.success ? quotesResult.data.map((quote) => [quote.code, quote]) : []);
  const { sectors, marketOverview } = await loadStrategySharedMarketContext(service, repository);

  return Promise.all(
    watchlistCodes.map(async (code) => {
      const quote = quotes.get(code);
      const input = await buildStrategyInputForCode(code, {
        service,
        repository,
        ...(quote ? { quoteOverride: quote } : {}),
        sectorsOverride: sectors,
        marketOverviewOverride: marketOverview,
        skipProviderHistorical: true,
      });
      const output = runAllStrategies(input);
      return {
        code,
        name: input.name,
        sectorIds: input.sectorIds,
        finalPlan: output.finalPlan,
        strategies: output.strategyResults,
        conflicts: output.conflicts,
        integrity: summarizeIntegrity(input.integrityReport),
      };
    }),
  );
}

export function getStrategyDashboardCandidates(items: StrategyWatchlistItem[]) {
  const ranked = [...items]
    .filter((item) => item.finalPlan.currentAction !== "data_blocked")
    .sort((a, b) => b.finalPlan.riskRewardRatio - a.finalPlan.riskRewardRatio || b.finalPlan.dataCompleteness - a.finalPlan.dataCompleteness);

  return {
    aLevel: ranked.filter((item) => item.finalPlan.grade === "A" || item.finalPlan.grade === "S").slice(0, 1),
    bLevel: ranked.filter((item) => item.finalPlan.grade === "B").slice(0, 2),
  };
}
