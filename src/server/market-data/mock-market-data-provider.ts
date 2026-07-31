import { getMockMarketHistory } from "../../data/mock-market-history";
import { getMockStockForCode, mockStocks } from "../../data/mock-stocks";
import type {
  MarketDailyBar,
  MarketOverview,
  SectorSnapshot,
  StockQuote,
} from "../../types/market-data";
import { assertAllowedStockCode } from "./market-data-errors";
import { normalizeMinuteBars } from "./minute-bars";
import type {
  DailyBarOptions,
  MarketDataProvider,
  MinuteBarOptions,
  ProviderHealth,
} from "./market-data-provider";
import { mockProviderCapabilities } from "./market-data-provider";

const source = "mock-provider";
const marketTimestamp = "2026-07-14T10:30:00+08:00";
const receivedAt = "2026-07-14T10:30:05+08:00";

export class MockMarketDataProvider implements MarketDataProvider {
  readonly source = source;
  readonly mode = "mock" as const;

  async getQuote(code: string): Promise<StockQuote> {
    assertAllowedStockCode(code);
    const stock = mockStocks.find((item) => item.code === code) ?? getMockStockForCode(code);
    const bars = getMockMarketHistory(code);
    const latest = bars.at(-1);
    const previous = bars.at(-2);
    const previousClose = previous?.close ?? stock.currentPrice / (1 + stock.changePercent / 100);
    const price = latest?.close ?? stock.currentPrice;

    return {
      code: stock.code,
      name: stock.name,
      exchange: code.startsWith("6") ? "SSE" : "SZSE",
      price,
      previousClose,
      open: latest?.open ?? price,
      high: latest?.high ?? price,
      low: latest?.low ?? price,
      change: Math.round((price - previousClose) * 100) / 100,
      changePercent: stock.changePercent,
      volume: latest?.volume ?? 0,
      amount: stock.turnover * 100_000_000,
      turnoverRate: stock.turnoverRate,
      volumeRatio: stock.volumeRatio,
      bidPrice: Math.round((price - 0.01) * 100) / 100,
      askPrice: Math.round((price + 0.01) * 100) / 100,
      marketTimestamp,
      receivedAt,
      status: "fresh",
      source,
      isDemo: true,
    };
  }

  async getQuotes(codes: string[]): Promise<StockQuote[]> {
    return Promise.all(codes.map((code) => this.getQuote(code)));
  }

  async getDailyBars(code: string, options: DailyBarOptions = {}): Promise<MarketDailyBar[]> {
    assertAllowedStockCode(code);
    const bars = getMockMarketHistory(code);
    const sliced = options.period === "120d" ? bars.slice(-120) : bars;

    return sliced.map((bar, index) => ({
      code,
      date: bar.date,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      previousClose: sliced[index - 1]?.close ?? bar.open,
      volume: bar.volume,
      amount: bar.turnover * 100_000_000,
      turnoverRate: 0,
      source,
      isDemo: true,
    }));
  }

  async getMinuteBars(code: string, options: MinuteBarOptions) {
    assertAllowedStockCode(code);
    const quote = await this.getQuote(code);
    const limit = Math.min(options.limit ?? 120, 240);
    const bars = Array.from({ length: 240 }, (_, index) => {
      const morning = index < 120;
      const minuteIndex = morning ? index : index - 120;
      const hour = morning ? 9 + Math.floor((30 + minuteIndex) / 60) : 13 + Math.floor(minuteIndex / 60);
      const minute = morning ? (30 + minuteIndex) % 60 : minuteIndex % 60;
      const drift = (index - 120) * 0.002;
      const open = Math.round((quote.previousClose + drift) * 100) / 100;
      const close = Math.round((open + ((index % 7) - 3) * 0.01) * 100) / 100;
      const high = Math.max(open, close) + 0.03;
      const low = Math.min(open, close) - 0.03;
      const volume = 10_000 + index * 50;
      const amount = Math.round(volume * close * 100) / 100;

      return {
        code,
        timestamp: `2026-07-14T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`,
        open,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close,
        volume,
        amount,
        averagePrice: close,
        previousClose: quote.previousClose,
        source,
        receivedAt,
        status: "fresh" as const,
        isDemo: true,
        isReplay: false,
      };
    });
    return normalizeMinuteBars(bars, options.period).slice(-limit);
  }

  async getSectorSnapshots(): Promise<SectorSnapshot[]> {
    const sectors = new Map<string, typeof mockStocks>();
    for (const stock of mockStocks) {
      sectors.set(stock.sector, [...(sectors.get(stock.sector) ?? []), stock]);
    }

    return Array.from(sectors.entries()).map(([name, stocks], index) => ({
      id: `sector-${index + 1}`,
      name,
      changePercent: Math.round((stocks.reduce((sum, stock) => sum + stock.changePercent, 0) / stocks.length) * 100) / 100,
      leadingStocks: stocks
        .sort((a, b) => b.sectorScore - a.sectorScore)
        .slice(0, 3)
        .map((stock) => stock.name),
      strengthScore: Math.round(stocks.reduce((sum, stock) => sum + stock.sectorScore, 0) / stocks.length),
      marketTimestamp,
      receivedAt,
      status: "fresh",
      source,
      isDemo: true,
    }));
  }

  async getMarketOverview(): Promise<MarketOverview> {
    const advancingCount = mockStocks.filter((stock) => stock.changePercent > 0).length;
    const decliningCount = mockStocks.filter((stock) => stock.changePercent < 0).length;

    return {
      tradingSession: "morning",
      marketTimestamp,
      receivedAt,
      status: "fresh",
      totalAmount: mockStocks.reduce((sum, stock) => sum + stock.turnover * 100_000_000, 0),
      advancingCount,
      decliningCount,
      unchangedCount: mockStocks.length - advancingCount - decliningCount,
      limitUpCount: 1,
      limitDownCount: 0,
      marketScore: 74,
      source,
      isDemo: true,
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      ok: true,
      source,
      mode: "mock",
      capabilities: mockProviderCapabilities,
      message: "Mock行情供应商可用",
    };
  }
}
