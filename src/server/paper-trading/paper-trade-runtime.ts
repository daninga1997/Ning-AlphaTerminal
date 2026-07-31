import { mockStocks } from "@/data/mock-stocks";
import { buildStrategyInputForCode } from "@/server/strategy-engine/strategy-input-builder";
import { runAllStrategies } from "@/server/strategy-engine/strategy-engine";
import { PrismaPaperTradeRepository } from "./paper-trade-repository";
import { createPaperTradeMarketService, type PaperTradeMarketSnapshot } from "./paper-trade-market-service";

export class PaperTradeError extends Error {
  constructor(
    readonly code:
      | "INVALID_PAPER_TRADE_CODE"
      | "INVALID_PAPER_TRADE_FILTER"
      | "PAPER_TRADE_NOT_FOUND"
      | "PAPER_TRADE_NOT_OPEN"
      | "PAPER_TRADE_QUOTE_UNAVAILABLE"
      | "PAPER_TRADE_LEVELS_UNAVAILABLE",
    readonly status: number,
  ) {
    super(code);
  }
}

export function createRuntimePaperTradeService() {
  const service = createPaperTradeMarketService(new PrismaPaperTradeRepository(), loadPaperTradeMarketSnapshot);
  return {
    ...service,
    async closeOpenById(id: string) {
      try {
        return await service.closeOpenById(id);
      } catch (error) {
        if (error instanceof Error && isKnownPaperTradeErrorCode(error.message)) {
          throw new PaperTradeError(error.message, error.message === "PAPER_TRADE_NOT_FOUND" ? 404 : 409);
        }
        throw error;
      }
    },
  };
}

export async function loadPaperTradeMarketSnapshot(code: string): Promise<PaperTradeMarketSnapshot> {
  if (!/^\d{6}$/.test(code)) throw new PaperTradeError("INVALID_PAPER_TRADE_CODE", 400);

  const input = await buildStrategyInputForCode(code);
  const quote = input.quote;
  if (!quote || quote.isDemo || quote.status === "stale" || quote.status === "unavailable") {
    throw new PaperTradeError("PAPER_TRADE_QUOTE_UNAVAILABLE", 409);
  }

  const plan = runAllStrategies(input).finalPlan;
  const takeProfitPrice = plan.targets.firstTarget.price;
  const stopLossPrice = plan.stopLoss.price;
  if (![takeProfitPrice, stopLossPrice].every((value) => Number.isFinite(value) && value > 0)) {
    throw new PaperTradeError("PAPER_TRADE_LEVELS_UNAVAILABLE", 409);
  }

  return {
    code,
    name: input.name,
    sector: mockStocks.find((stock) => stock.code === code)?.sector ?? input.sectorIds.join(", "),
    quote: {
      price: quote.price,
      marketTimestamp: quote.marketTimestamp,
      source: quote.source,
    },
    takeProfitPrice,
    stopLossPrice,
    completedDailyBars: input.dailyBars.map((bar) => ({ date: bar.date, close: bar.close })),
  };
}

function isKnownPaperTradeErrorCode(
  code: string,
): code is "PAPER_TRADE_NOT_FOUND" | "PAPER_TRADE_NOT_OPEN" | "PAPER_TRADE_QUOTE_UNAVAILABLE" {
  return code === "PAPER_TRADE_NOT_FOUND" || code === "PAPER_TRADE_NOT_OPEN" || code === "PAPER_TRADE_QUOTE_UNAVAILABLE";
}
