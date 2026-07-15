import { describe, expect, it } from "vitest";
import { dedupeDailyBars, dedupeMinuteBars } from "./market-data-deduplication";
import { marketDataChecksum } from "./market-data-checksum";
import { toStoredDailyBar, toStoredQuoteSnapshot } from "./market-data-mappers";
import type { MarketDailyBar, StockQuote } from "../../types/market-data";

const dailyBar: MarketDailyBar = {
  code: "002472",
  date: "2026-07-14",
  open: 40,
  high: 42,
  low: 39,
  close: 41,
  previousClose: 40,
  volume: 1000,
  amount: 41000,
  turnoverRate: 2,
  source: "AKShare stock_zh_a_hist",
  isDemo: false,
};

const quote: StockQuote = {
  code: "002472",
  name: "双环传动",
  exchange: "SZSE",
  price: 42.39,
  previousClose: 42.14,
  open: 42,
  high: 42.8,
  low: 41.9,
  change: 0.25,
  changePercent: 0.593,
  volume: 1000,
  amount: 42390,
  turnoverRate: 1.2,
  volumeRatio: 1.1,
  bidPrice: 42.38,
  askPrice: 42.39,
  marketTimestamp: "2026-07-14T15:00:00+08:00",
  receivedAt: "2026-07-14T15:00:01+08:00",
  status: "delayed",
  source: "AKShare stock_zh_a_spot",
  isDemo: false,
  strategyUsed: "sina_spot",
};

describe("market storage helpers", () => {
  it("daily upsert identity keeps different adjustment versions separate", () => {
    const qfq = toStoredDailyBar(dailyBar, "qfq");
    const none = toStoredDailyBar(dailyBar, "none");
    expect(dedupeDailyBars([qfq, qfq, none])).toHaveLength(2);
  });

  it("minute upsert identity removes duplicate source-period timestamps", () => {
    const timestamp = new Date("2026-07-14T10:00:00+08:00");
    const bar = {
      code: "002472",
      tradingDate: "2026-07-14",
      timestamp,
      period: "1m" as const,
      open: 1,
      high: 2,
      low: 1,
      close: 2,
      volume: 100,
      amount: 200,
      averagePrice: 2,
      source: "AKShare stock_zh_a_hist_min_em",
      fetchedAt: new Date(),
      dataStatus: "delayed" as const,
      checksum: "x",
    };
    expect(dedupeMinuteBars([bar, bar])).toHaveLength(1);
  });

  it("does not accept NaN or Infinity in stored quote snapshots", () => {
    expect(() => toStoredQuoteSnapshot({ ...quote, price: Number.NaN })).toThrow(/市场数据字段无效/);
    expect(() => toStoredQuoteSnapshot({ ...quote, amount: Number.POSITIVE_INFINITY })).toThrow(/市场数据字段无效/);
  });

  it("checksum is deterministic for equal market payloads", () => {
    expect(marketDataChecksum({ b: 2, a: 1 })).toBe(marketDataChecksum({ a: 1, b: 2 }));
  });
});
