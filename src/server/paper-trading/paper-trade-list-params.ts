import type { PaperTradeListStatus, PaperTradeSort } from "./paper-trade-statistics";

const validStatuses = new Set<PaperTradeListStatus>(["all", "open", "closed"]);
const validSorts = new Set<PaperTradeSort>(["entryTime", "exitTime", "returnPercent"]);

export function parsePaperTradeListParams(searchParams: URLSearchParams): {
  status: PaperTradeListStatus;
  sort: PaperTradeSort;
} {
  const status = (searchParams.get("status") ?? "all") as PaperTradeListStatus;
  const sort = (searchParams.get("sort") ?? "entryTime") as PaperTradeSort;
  if (!validStatuses.has(status) || !validSorts.has(sort)) throw new Error("INVALID_PAPER_TRADE_FILTER");
  return { status, sort };
}

