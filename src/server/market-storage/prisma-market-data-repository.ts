import type { PrismaClient } from "@prisma/client";
import { marketStoragePrisma } from "./prisma-client";
import { marketDataChecksum } from "./market-data-checksum";
import { dedupeDailyBars, dedupeMinuteBars } from "./market-data-deduplication";
import type {
  FetchHealthSummary,
  MarketCoverageSummary,
  MarketDataRepository,
  MarketStorageDataType,
  StoredDailyMarketBar,
  StoredDataFetchRun,
  StoredMarketOverviewSnapshot,
  StoredMinuteMarketBar,
  StoredSectorDailySnapshot,
  StoredStockQuoteSnapshot,
} from "./market-data-repository";

type Db = PrismaClient;

export class PrismaMarketDataRepository implements MarketDataRepository {
  constructor(private readonly db: Db = marketStoragePrisma) {}

  async upsertDailyBars(bars: StoredDailyMarketBar[]): Promise<number> {
    const uniqueBars = dedupeDailyBars(bars);
    await Promise.all(
      uniqueBars.map((bar) =>
        this.db.dailyMarketBar.upsert({
          where: {
            code_tradingDate_adjustment_source: {
              code: bar.code,
              tradingDate: bar.tradingDate,
              adjustment: bar.adjustment,
              source: bar.source,
            },
          },
          update: {
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            previousClose: bar.previousClose,
            volume: bar.volume,
            amount: bar.amount,
            turnoverRate: bar.turnoverRate,
            fetchedAt: bar.fetchedAt,
            marketTimestamp: bar.marketTimestamp,
            dataStatus: bar.dataStatus,
            checksum: bar.checksum ?? marketDataChecksum(bar),
          },
          create: {
            code: bar.code,
            tradingDate: bar.tradingDate,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            previousClose: bar.previousClose,
            volume: bar.volume,
            amount: bar.amount,
            turnoverRate: bar.turnoverRate,
            adjustment: bar.adjustment,
            source: bar.source,
            fetchedAt: bar.fetchedAt,
            marketTimestamp: bar.marketTimestamp,
            dataStatus: bar.dataStatus,
            checksum: bar.checksum ?? marketDataChecksum(bar),
          },
        }),
      ),
    );
    return uniqueBars.length;
  }

  async getDailyBars(input: Parameters<MarketDataRepository["getDailyBars"]>[0]): Promise<StoredDailyMarketBar[]> {
    return this.db.dailyMarketBar.findMany({
      where: {
        code: input.code,
        adjustment: input.adjustment,
        source: input.source,
        tradingDate: {
          gte: input.from,
          lte: input.to,
        },
      },
      orderBy: { tradingDate: "asc" },
      take: input.limit,
    }) as Promise<StoredDailyMarketBar[]>;
  }

  async upsertMinuteBars(bars: StoredMinuteMarketBar[]): Promise<number> {
    const uniqueBars = dedupeMinuteBars(bars);
    await Promise.all(
      uniqueBars.map((bar) =>
        this.db.minuteMarketBar.upsert({
          where: {
            code_timestamp_period_source: {
              code: bar.code,
              timestamp: bar.timestamp,
              period: bar.period,
              source: bar.source,
            },
          },
          update: {
            tradingDate: bar.tradingDate,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            amount: bar.amount,
            averagePrice: bar.averagePrice,
            fetchedAt: bar.fetchedAt,
            dataStatus: bar.dataStatus,
            checksum: bar.checksum ?? marketDataChecksum(bar),
          },
          create: {
            code: bar.code,
            tradingDate: bar.tradingDate,
            timestamp: bar.timestamp,
            period: bar.period,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            amount: bar.amount,
            averagePrice: bar.averagePrice,
            source: bar.source,
            fetchedAt: bar.fetchedAt,
            dataStatus: bar.dataStatus,
            checksum: bar.checksum ?? marketDataChecksum(bar),
          },
        }),
      ),
    );
    return uniqueBars.length;
  }

  async getMinuteBars(input: Parameters<MarketDataRepository["getMinuteBars"]>[0]): Promise<StoredMinuteMarketBar[]> {
    return this.db.minuteMarketBar.findMany({
      where: {
        code: input.code,
        period: input.period,
        tradingDate: input.tradingDate,
        source: input.source,
        timestamp: {
          gte: input.from,
          lte: input.to,
        },
      },
      orderBy: { timestamp: "asc" },
      take: input.limit,
    }) as Promise<StoredMinuteMarketBar[]>;
  }

  async saveQuoteSnapshots(quotes: StoredStockQuoteSnapshot[]): Promise<number> {
    if (quotes.length === 0) return 0;
    const result = await this.db.stockQuoteSnapshot.createMany({ data: quotes });
    return result.count;
  }

  async getLatestQuoteSnapshot(code: string): Promise<StoredStockQuoteSnapshot | null> {
    return this.db.stockQuoteSnapshot.findFirst({
      where: { code },
      orderBy: { marketTimestamp: "desc" },
    }) as Promise<StoredStockQuoteSnapshot | null>;
  }

  async saveSectorSnapshots(sectors: StoredSectorDailySnapshot[]): Promise<number> {
    await Promise.all(
      sectors.map((sector) =>
        this.db.sectorDailySnapshot.upsert({
          where: {
            sectorId_tradingDate_source: {
              sectorId: sector.sectorId,
              tradingDate: sector.tradingDate,
              source: sector.source,
            },
          },
          update: {
            sectorName: sector.sectorName,
            changePercent: sector.changePercent,
            advancingCount: sector.advancingCount,
            decliningCount: sector.decliningCount,
            unchangedCount: sector.unchangedCount,
            limitUpCount: sector.limitUpCount,
            totalAmount: sector.totalAmount,
            strengthScore: sector.strengthScore,
            leadingStocksJson: sector.leadingStocksJson,
            fetchedAt: sector.fetchedAt,
            dataStatus: sector.dataStatus,
          },
          create: sector,
        }),
      ),
    );
    return sectors.length;
  }

  async getSectorSnapshots(input: Parameters<MarketDataRepository["getSectorSnapshots"]>[0] = {}): Promise<StoredSectorDailySnapshot[]> {
    return this.db.sectorDailySnapshot.findMany({
      where: { tradingDate: input.tradingDate, source: input.source },
      orderBy: [{ tradingDate: "desc" }, { strengthScore: "desc" }],
    }) as Promise<StoredSectorDailySnapshot[]>;
  }

  async saveMarketOverview(snapshot: StoredMarketOverviewSnapshot): Promise<StoredMarketOverviewSnapshot> {
    return this.db.marketOverviewSnapshot.upsert({
      where: {
        tradingDate_source: {
          tradingDate: snapshot.tradingDate,
          source: snapshot.source,
        },
      },
      update: {
        marketTimestamp: snapshot.marketTimestamp,
        totalAmount: snapshot.totalAmount,
        advancingCount: snapshot.advancingCount,
        decliningCount: snapshot.decliningCount,
        unchangedCount: snapshot.unchangedCount,
        limitUpCount: snapshot.limitUpCount,
        limitDownCount: snapshot.limitDownCount,
        marketScore: snapshot.marketScore,
        fetchedAt: snapshot.fetchedAt,
        dataStatus: snapshot.dataStatus,
      },
      create: snapshot,
    }) as Promise<StoredMarketOverviewSnapshot>;
  }

  async getLatestMarketOverview(source?: string): Promise<StoredMarketOverviewSnapshot | null> {
    return this.db.marketOverviewSnapshot.findFirst({
      where: { source },
      orderBy: { marketTimestamp: "desc" },
    }) as Promise<StoredMarketOverviewSnapshot | null>;
  }

  async saveFetchRun(run: StoredDataFetchRun): Promise<StoredDataFetchRun> {
    return this.db.dataFetchRun.create({ data: run }) as Promise<StoredDataFetchRun>;
  }

  async getFetchHealthSummary(dataType?: MarketStorageDataType): Promise<FetchHealthSummary[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const runs = await this.db.dataFetchRun.findMany({
      where: { dataType, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    });
    const grouped = new Map<string, typeof runs>();
    runs.forEach((run) => {
      const key = run.dataType as MarketStorageDataType;
      grouped.set(key, [...(grouped.get(key) ?? []), run]);
    });
    return Array.from(grouped.entries()).map(([type, typeRuns]) => {
      const successful = typeRuns.filter((run) => run.success);
      const failed = typeRuns.filter((run) => !run.success);
      return {
        dataType: type as MarketStorageDataType,
        totalRuns24h: typeRuns.length,
        successfulRuns24h: successful.length,
        successRate24h: typeRuns.length === 0 ? 0 : Math.round((successful.length / typeRuns.length) * 100),
        lastSuccessAt: successful[0]?.completedAt ?? successful[0]?.createdAt ?? null,
        lastFailureAt: failed[0]?.completedAt ?? failed[0]?.createdAt ?? null,
      };
    });
  }

  async getCoverageSummary(codes: string[]): Promise<MarketCoverageSummary> {
    const [latestQuote, latestDaily, dailyDistinct, latestMinute, latestSector, sectorCount, latestOverview, quoteCodes, minuteCodes] =
      await Promise.all([
        this.db.stockQuoteSnapshot.findFirst({ orderBy: { marketTimestamp: "desc" } }),
        this.db.dailyMarketBar.findFirst({ orderBy: { tradingDate: "desc" } }),
        this.db.dailyMarketBar.findMany({ where: { code: { in: codes }, adjustment: "qfq" }, select: { tradingDate: true }, distinct: ["tradingDate"] }),
        this.db.minuteMarketBar.findFirst({ orderBy: { timestamp: "desc" } }),
        this.db.sectorDailySnapshot.findFirst({ orderBy: { tradingDate: "desc" } }),
        this.db.sectorDailySnapshot.count(),
        this.db.marketOverviewSnapshot.findFirst({ orderBy: { marketTimestamp: "desc" } }),
        this.db.stockQuoteSnapshot.findMany({ where: { code: { in: codes } }, select: { code: true }, distinct: ["code"] }),
        this.db.minuteMarketBar.findMany({ where: { code: { in: codes } }, select: { code: true }, distinct: ["code"] }),
      ]);

    return {
      quotes: {
        latestTradingDate: latestQuote?.tradingDate ?? null,
        codeCount: quoteCodes.length,
        lastSuccessAt: latestQuote?.fetchedAt ?? null,
      },
      dailyBars: {
        latestTradingDate: latestDaily?.tradingDate ?? null,
        codeCount: codes.length === 0 ? 0 : await this.countDailyCoveredCodes(codes),
        coverageDays: dailyDistinct.length,
        lastSuccessAt: latestDaily?.fetchedAt ?? null,
      },
      minuteBars: {
        latestMinuteTimestamp: latestMinute?.timestamp ?? null,
        codeCount: minuteCodes.length,
        completenessPercent: codes.length === 0 ? 0 : Math.round((minuteCodes.length / codes.length) * 100),
        lastSuccessAt: latestMinute?.fetchedAt ?? null,
      },
      sectors: {
        latestTradingDate: latestSector?.tradingDate ?? null,
        sectorCount,
        lastSuccessAt: latestSector?.fetchedAt ?? null,
      },
      marketOverview: {
        latestTradingDate: latestOverview?.tradingDate ?? null,
        lastSuccessAt: latestOverview?.fetchedAt ?? null,
      },
    };
  }

  private async countDailyCoveredCodes(codes: string[]): Promise<number> {
    const rows = await this.db.dailyMarketBar.findMany({
      where: { code: { in: codes }, adjustment: "qfq" },
      select: { code: true },
      distinct: ["code"],
    });
    return rows.length;
  }
}
