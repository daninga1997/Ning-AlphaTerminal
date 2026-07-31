export type PaperTradeStatus = "open" | "take_profit" | "stop_loss" | "expired" | "manual_closed";

export type PaperTradeRecord = {
  id: string;
  code: string;
  name: string;
  sector: string;
  entryPrice: number;
  entryTime: string;
  entryTradingDate: string;
  takeProfitPrice: number;
  stopLossPrice: number;
  status: PaperTradeStatus;
  exitPrice: number | null;
  exitTime: string | null;
  returnPercent: number | null;
  settlementReason: string | null;
  marketDataSource: string;
  marketTimestamp: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

type CompletedDailyBar = {
  date: string;
  close: number;
};

export type PaperTradeSettlement = {
  status: Exclude<PaperTradeStatus, "open">;
  exitPrice: number;
  returnPercent: number;
  settlementReason: string;
  settledTradingDate: string | null;
};

export function settlePaperTrade({
  trade,
  latestQuotePrice,
  completedDailyBars,
}: {
  trade: PaperTradeRecord;
  latestQuotePrice: number | null;
  completedDailyBars: CompletedDailyBar[];
}): PaperTradeSettlement | null {
  if (trade.status !== "open") return null;

  if (isFinitePositive(latestQuotePrice) && latestQuotePrice >= trade.takeProfitPrice) {
    return settlement("take_profit", trade.entryPrice, trade.takeProfitPrice, "take_profit_reached", null);
  }

  if (isFinitePositive(latestQuotePrice) && latestQuotePrice <= trade.stopLossPrice) {
    return settlement("stop_loss", trade.entryPrice, trade.stopLossPrice, "stop_loss_reached", null);
  }

  const expiryBar = completedDailyBars
    .filter((bar) => bar.date > trade.entryTradingDate && isFinitePositive(bar.close))
    .sort((a, b) => a.date.localeCompare(b.date))[4];
  if (!expiryBar) return null;

  return settlement("expired", trade.entryPrice, expiryBar.close, "five_trading_days_expired", expiryBar.date);
}

export function createManualPaperTradeSettlement(
  trade: PaperTradeRecord,
  exitPrice: number,
): PaperTradeSettlement {
  if (trade.status !== "open") throw new Error("PAPER_TRADE_NOT_OPEN");
  if (!isFinitePositive(exitPrice)) throw new Error("PAPER_TRADE_QUOTE_UNAVAILABLE");

  return settlement("manual_closed", trade.entryPrice, exitPrice, "manual_closed", null);
}

function settlement(
  status: PaperTradeSettlement["status"],
  entryPrice: number,
  exitPrice: number,
  settlementReason: string,
  settledTradingDate: string | null,
): PaperTradeSettlement {
  const normalizedExitPrice = roundPrice(exitPrice);

  return {
    status,
    exitPrice: normalizedExitPrice,
    returnPercent: roundPercent(((normalizedExitPrice - entryPrice) / entryPrice) * 100),
    settlementReason,
    settledTradingDate,
  };
}

function isFinitePositive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

function roundPercent(value: number): number {
  return Number(value.toFixed(2));
}
