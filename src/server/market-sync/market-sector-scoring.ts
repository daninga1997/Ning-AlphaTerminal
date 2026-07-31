import type { StockQuote } from "../../types/market-data";
import type { StoredSectorDailySnapshot } from "../market-storage/market-data-repository";
import type { CoreSectorMapping } from "./sector-mapping";

export type SectorScoreBreakdownItem = {
  name: string;
  rawValue: number | null;
  score: number;
  maxScore: number;
  source: string;
  calculatedAt: string;
  missingReason: string | null;
};

export type SectorScoreResult = {
  snapshot: StoredSectorDailySnapshot;
  breakdown: SectorScoreBreakdownItem[];
  isPartial: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scorePositivePercent(value: number, maxScore: number): number {
  return clamp(Math.round(((value + 3) / 8) * maxScore), 0, maxScore);
}

export function scoreCoreSector(mapping: CoreSectorMapping, quotes: StockQuote[], fetchedAt = new Date()): SectorScoreResult {
  const sectorQuotes = quotes.filter((quote) => mapping.codes.includes(quote.code));
  const source = sectorQuotes[0]?.source ?? "tencent quote sector proxy";
  const averageChange = sectorQuotes.length === 0 ? 0 : sectorQuotes.reduce((sum, quote) => sum + quote.changePercent, 0) / sectorQuotes.length;
  const advancingCount = sectorQuotes.filter((quote) => quote.changePercent > 0).length;
  const decliningCount = sectorQuotes.filter((quote) => quote.changePercent < 0).length;
  const unchangedCount = sectorQuotes.length - advancingCount - decliningCount;
  const limitUpCount = sectorQuotes.filter((quote) => quote.changePercent >= 9.8).length;
  const totalAmount = sectorQuotes.reduce((sum, quote) => sum + quote.amount, 0);
  const leadingStocks = [...sectorQuotes].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3).map((quote) => quote.code);
  const calculatedAt = fetchedAt.toISOString();
  const missingReason = sectorQuotes.length === mapping.codes.length ? null : `仅覆盖${sectorQuotes.length}/${mapping.codes.length}只映射股票`;

  const breakdown: SectorScoreBreakdownItem[] = [
    { name: "当日涨跌幅", rawValue: averageChange, score: scorePositivePercent(averageChange, 20), maxScore: 20, source, calculatedAt, missingReason: null },
    {
      name: "上涨家数占比",
      rawValue: sectorQuotes.length ? advancingCount / sectorQuotes.length : null,
      score: sectorQuotes.length ? Math.round((advancingCount / sectorQuotes.length) * 15) : 0,
      maxScore: 15,
      source,
      calculatedAt,
      missingReason,
    },
    { name: "涨停数量", rawValue: limitUpCount, score: clamp(limitUpCount * 5, 0, 15), maxScore: 15, source, calculatedAt, missingReason },
    { name: "成交额相对5日均值", rawValue: null, score: 0, maxScore: 15, source, calculatedAt, missingReason: "未接入板块5日成交额均值" },
    { name: "5日相对强度", rawValue: null, score: 0, maxScore: 15, source, calculatedAt, missingReason: "未接入板块5日历史强度" },
    { name: "龙头股票表现", rawValue: sectorQuotes[0]?.changePercent ?? null, score: scorePositivePercent(Math.max(...sectorQuotes.map((quote) => quote.changePercent), -3), 10), maxScore: 10, source, calculatedAt, missingReason },
    { name: "板块持续性", rawValue: null, score: 0, maxScore: 10, source, calculatedAt, missingReason: "需要连续多日板块快照" },
  ];
  const strengthScore = breakdown.reduce((sum, item) => sum + item.score, 0);

  return {
    snapshot: {
      sectorId: mapping.sectorId,
      sectorName: mapping.sectorName,
      tradingDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(fetchedAt),
      changePercent: Number(averageChange.toFixed(2)),
      advancingCount,
      decliningCount,
      unchangedCount,
      limitUpCount,
      totalAmount,
      strengthScore,
      leadingStocksJson: JSON.stringify(leadingStocks),
      source,
      fetchedAt,
      dataStatus: missingReason ? "partial" : "delayed",
    },
    breakdown,
    isPartial: Boolean(missingReason) || breakdown.some((item) => item.missingReason),
  };
}
