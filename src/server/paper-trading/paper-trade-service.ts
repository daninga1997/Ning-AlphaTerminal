import type { CreatePaperTradeInput, PaperTradeRepository } from "./paper-trade-repository";
import { settlePaperTrade } from "./paper-trade-settlement";

export function createPaperTradeService(repository: PaperTradeRepository) {
  return {
    async create(input: CreatePaperTradeInput) {
      if (!input.isDemo) throw new Error("PAPER_TRADE_MUST_BE_DEMO");
      if (!input.code.match(/^(000|001|002|003)\d{3}$/)) throw new Error("INVALID_PAPER_TRADE_CODE");
      if (![input.entryPrice, input.takeProfitPrice, input.stopLossPrice].every((value) => Number.isFinite(value) && value > 0)) {
        throw new Error("INVALID_PAPER_TRADE_PRICE");
      }

      const existing = await repository.findOpenByCode(input.code);
      return existing ?? repository.createOpen(input);
    },

    async settleOpenByCode(
      code: string,
      market: {
        latestQuotePrice: number | null;
        completedDailyBars: Array<{ date: string; close: number }>;
        settledAt: string;
      },
    ) {
      const trade = await repository.findOpenByCode(code);
      if (!trade) return null;

      const settlement = settlePaperTrade({
        trade,
        latestQuotePrice: market.latestQuotePrice,
        completedDailyBars: market.completedDailyBars,
      });
      if (!settlement) return trade;

      return repository.settle(trade.id, settlement, market.settledAt);
    },
  };
}
