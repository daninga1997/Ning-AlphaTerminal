-- CreateTable
CREATE TABLE "DailyMarketBar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "tradingDate" TEXT NOT NULL,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "close" REAL NOT NULL,
    "previousClose" REAL NOT NULL,
    "volume" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "turnoverRate" REAL NOT NULL,
    "adjustment" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL,
    "marketTimestamp" DATETIME,
    "dataStatus" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MinuteMarketBar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "tradingDate" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "period" TEXT NOT NULL,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "close" REAL NOT NULL,
    "volume" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "averagePrice" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL,
    "dataStatus" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StockQuoteSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "tradingDate" TEXT NOT NULL,
    "marketTimestamp" DATETIME NOT NULL,
    "price" REAL NOT NULL,
    "previousClose" REAL NOT NULL,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "change" REAL NOT NULL,
    "changePercent" REAL NOT NULL,
    "volume" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "turnoverRate" REAL NOT NULL,
    "volumeRatio" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "strategyUsed" TEXT,
    "dataStatus" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SectorDailySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectorId" TEXT NOT NULL,
    "sectorName" TEXT NOT NULL,
    "tradingDate" TEXT NOT NULL,
    "changePercent" REAL NOT NULL,
    "advancingCount" INTEGER NOT NULL,
    "decliningCount" INTEGER NOT NULL,
    "unchangedCount" INTEGER NOT NULL,
    "limitUpCount" INTEGER NOT NULL,
    "totalAmount" REAL NOT NULL,
    "strengthScore" REAL NOT NULL,
    "leadingStocksJson" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL,
    "dataStatus" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MarketOverviewSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradingDate" TEXT NOT NULL,
    "marketTimestamp" DATETIME NOT NULL,
    "totalAmount" REAL NOT NULL,
    "advancingCount" INTEGER NOT NULL,
    "decliningCount" INTEGER NOT NULL,
    "unchangedCount" INTEGER NOT NULL,
    "limitUpCount" INTEGER NOT NULL,
    "limitDownCount" INTEGER NOT NULL,
    "marketScore" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL,
    "dataStatus" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DataFetchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataType" TEXT NOT NULL,
    "requestedCodesJson" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "strategyUsed" TEXT,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "success" BOOLEAN NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "missingCodesJson" TEXT NOT NULL,
    "errorCode" TEXT,
    "durationMs" INTEGER NOT NULL,
    "usedStaleCache" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyMarketBar_code_tradingDate_adjustment_source_key" ON "DailyMarketBar"("code", "tradingDate", "adjustment", "source");
CREATE INDEX "DailyMarketBar_code_tradingDate_idx" ON "DailyMarketBar"("code", "tradingDate");
CREATE INDEX "DailyMarketBar_dataStatus_idx" ON "DailyMarketBar"("dataStatus");

-- CreateIndex
CREATE UNIQUE INDEX "MinuteMarketBar_code_timestamp_period_source_key" ON "MinuteMarketBar"("code", "timestamp", "period", "source");
CREATE INDEX "MinuteMarketBar_code_tradingDate_period_idx" ON "MinuteMarketBar"("code", "tradingDate", "period");
CREATE INDEX "MinuteMarketBar_dataStatus_idx" ON "MinuteMarketBar"("dataStatus");

-- CreateIndex
CREATE INDEX "StockQuoteSnapshot_code_tradingDate_idx" ON "StockQuoteSnapshot"("code", "tradingDate");
CREATE INDEX "StockQuoteSnapshot_code_marketTimestamp_idx" ON "StockQuoteSnapshot"("code", "marketTimestamp");
CREATE INDEX "StockQuoteSnapshot_dataStatus_idx" ON "StockQuoteSnapshot"("dataStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SectorDailySnapshot_sectorId_tradingDate_source_key" ON "SectorDailySnapshot"("sectorId", "tradingDate", "source");
CREATE INDEX "SectorDailySnapshot_tradingDate_idx" ON "SectorDailySnapshot"("tradingDate");
CREATE INDEX "SectorDailySnapshot_dataStatus_idx" ON "SectorDailySnapshot"("dataStatus");

-- CreateIndex
CREATE UNIQUE INDEX "MarketOverviewSnapshot_tradingDate_source_key" ON "MarketOverviewSnapshot"("tradingDate", "source");
CREATE INDEX "MarketOverviewSnapshot_dataStatus_idx" ON "MarketOverviewSnapshot"("dataStatus");

-- CreateIndex
CREATE INDEX "DataFetchRun_dataType_createdAt_idx" ON "DataFetchRun"("dataType", "createdAt");
CREATE INDEX "DataFetchRun_success_idx" ON "DataFetchRun"("success");
