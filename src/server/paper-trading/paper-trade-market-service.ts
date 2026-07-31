import type { PaperTradeRepository } from "./paper-trade-repository";
import { calculatePaperTradeStatistics, filterPaperTrades, sortPaperTrades, type PaperTradeListStatus, type PaperTradeSort } from "./paper-trade-statistics";
import { createManualPaperTradeSettlement, settlePaperTrade } from "./paper-trade-settlement";
import { createPaperTradeService } from "./paper-trade-service";

export type PaperTradeMarketSnapshot = {
  code: string;
  name: string;
  sector: string;
  quote: {
    price: number;
    marketTimestamp: string;
    source: string;
  } | null;
  takeProfitPrice: number;
  stopLossPrice: number;
  completedDailyBars: Array<{ date: string; close: number }>;
};

export type PaperTradeLiveQuote = NonNullable<PaperTradeMarketSnapshot["quote"]>;

export function createPaperTradeMarketService(
  repository: PaperTradeRepository,
  loadSnapshot: (code: string) => Promise<PaperTradeMarketSnapshot>,
  now: () => Date = () => new Date(),
) {
  const service = createPaperTradeService(repository);

  return {
    async createFromCurrentMarket(code: string) {
      const snapshot = await loadSnapshot(code);
      if (!snapshot.quote) throw new Error("PAPER_TRADE_QUOTE_UNAVAILABLE");

      const entryTime = now().toISOString();
      return service.create({
        code: snapshot.code,
        name: snapshot.name,
        sector: snapshot.sector,
        entryPrice: snapshot.quote.price,
        entryTime,
        entryTradingDate: snapshot.quote.marketTimestamp.slice(0, 10),
        takeProfitPrice: snapshot.takeProfitPrice,
        stopLossPrice: snapshot.stopLossPrice,
        marketDataSource: snapshot.quote.source,
        marketTimestamp: snapshot.quote.marketTimestamp,
        isDemo: true,
      });
    },

    async listAndSettle(code: string) {
      const snapshot = await loadSnapshot(code);
      await service.settleOpenByCode(code, {
        latestQuotePrice: snapshot.quote?.price ?? null,
        completedDailyBars: snapshot.completedDailyBars,
        settledAt: now().toISOString(),
      });
      return {
        latestQuotePrice: snapshot.quote?.price ?? null,
        latestQuoteTimestamp: snapshot.quote?.marketTimestamp ?? null,
        trades: await repository.listByCode(code),
      };
    },

    async closeOpenById(id: string) {
      const trade = await repository.findById(id);
      if (!trade) throw new Error("PAPER_TRADE_NOT_FOUND");
      if (trade.status !== "open") throw new Error("PAPER_TRADE_NOT_OPEN");

      const snapshot = await loadSnapshot(trade.code);
      const quotePrice = snapshot.quote?.price ?? null;
      if (quotePrice === null || !Number.isFinite(quotePrice) || quotePrice <= 0) {
        throw new Error("PAPER_TRADE_QUOTE_UNAVAILABLE");
      }

      const settledTrade = await repository.settle(
        trade.id,
        createManualPaperTradeSettlement(trade, quotePrice),
        now().toISOString(),
      );
      const trades = await repository.listAll();
      return {
        trade: settledTrade,
        statistics: calculatePaperTradeStatistics(trades),
      };
    },

    async listAllAndSettle(status: PaperTradeListStatus, sort: PaperTradeSort) {
      const openTrades = await repository.listOpen();
      const liveQuotesByTradeId: Record<string, PaperTradeLiveQuote | null> = {};
      await Promise.all(openTrades.map(async (trade) => {
        try {
          const snapshot = await loadSnapshot(trade.code);
          liveQuotesByTradeId[trade.id] = snapshot.quote;
          const settlement = settlePaperTrade({
            trade,
            latestQuotePrice: snapshot.quote?.price ?? null,
            completedDailyBars: snapshot.completedDailyBars,
          });
          if (settlement) await repository.settle(trade.id, settlement, now().toISOString());
        } catch {
          liveQuotesByTradeId[trade.id] = null;
          // A single unavailable quote must not make the ledger unavailable.
        }
      }));

      const trades = await repository.listAll();
      for (const trade of trades) {
        if (trade.status !== "open") delete liveQuotesByTradeId[trade.id];
      }
      return {
        trades: sortPaperTrades(filterPaperTrades(trades, status), sort),
        statistics: calculatePaperTradeStatistics(trades),
        liveQuotesByTradeId,
      };
    },
  };
}
