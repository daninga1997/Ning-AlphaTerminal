-- CreateTable
CREATE TABLE "PaperTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "entryPrice" REAL NOT NULL,
    "entryTime" DATETIME NOT NULL,
    "entryTradingDate" TEXT NOT NULL,
    "takeProfitPrice" REAL NOT NULL,
    "stopLossPrice" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "exitPrice" REAL,
    "exitTime" DATETIME,
    "returnPercent" REAL,
    "settlementReason" TEXT,
    "openKey" TEXT,
    "marketDataSource" TEXT NOT NULL,
    "marketTimestamp" DATETIME NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PaperTrade_openKey_key" ON "PaperTrade"("openKey");
CREATE INDEX "PaperTrade_code_status_idx" ON "PaperTrade"("code", "status");
CREATE INDEX "PaperTrade_status_entryTime_idx" ON "PaperTrade"("status", "entryTime");
