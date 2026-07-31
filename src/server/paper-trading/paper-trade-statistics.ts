import type { PaperTradeRecord, PaperTradeStatus } from "./paper-trade-settlement";

export type PaperTradeListStatus = "all" | "open" | "closed";
export type PaperTradeSort = "entryTime" | "exitTime" | "returnPercent";

export type PaperTradeStatistics = {
  totalCount: number;
  settledCount: number;
  winRate: number | null;
  totalReturnPercent: number | null;
  averageReturnPercent: number | null;
};

const settledStatuses = new Set<PaperTradeStatus>([
  "take_profit",
  "stop_loss",
  "expired",
  "manual_closed",
]);

export function isSettledPaperTrade(trade: PaperTradeRecord): boolean {
  return settledStatuses.has(trade.status);
}

export function filterPaperTrades(
  trades: PaperTradeRecord[],
  status: PaperTradeListStatus,
): PaperTradeRecord[] {
  if (status === "open") return trades.filter((trade) => trade.status === "open");
  if (status === "closed") return trades.filter(isSettledPaperTrade);
  return trades;
}

export function sortPaperTrades(
  trades: PaperTradeRecord[],
  sort: PaperTradeSort,
): PaperTradeRecord[] {
  return [...trades].sort((left, right) => {
    if (sort === "returnPercent") return (right.returnPercent ?? Number.NEGATIVE_INFINITY) - (left.returnPercent ?? Number.NEGATIVE_INFINITY);
    const leftValue = sort === "entryTime" ? left.entryTime : left.exitTime;
    const rightValue = sort === "entryTime" ? right.entryTime : right.exitTime;
    return (rightValue ?? "").localeCompare(leftValue ?? "");
  });
}

export function calculatePaperTradeStatistics(trades: PaperTradeRecord[]): PaperTradeStatistics {
  const realized = trades.filter((trade) => isSettledPaperTrade(trade) && trade.returnPercent !== null);
  if (realized.length === 0) {
    return {
      totalCount: trades.length,
      settledCount: 0,
      winRate: null,
      totalReturnPercent: null,
      averageReturnPercent: null,
    };
  }

  const totalReturnPercent = round(realized.reduce((sum, trade) => sum + (trade.returnPercent ?? 0), 0));
  return {
    totalCount: trades.length,
    settledCount: realized.length,
    winRate: round((realized.filter((trade) => (trade.returnPercent ?? 0) > 0).length / realized.length) * 100),
    totalReturnPercent,
    averageReturnPercent: round(totalReturnPercent / realized.length),
  };
}

function round(value: number): number {
  return Number(value.toFixed(2));
}
