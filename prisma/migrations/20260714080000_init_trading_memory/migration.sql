-- CreateTable
CREATE TABLE "TradingPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idempotencyKey" TEXT NOT NULL,
    "planDate" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "originalSignal" TEXT NOT NULL,
    "finalSignal" TEXT NOT NULL,
    "shortTermScore" INTEGER NOT NULL,
    "midTermScore" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "firstEntryLow" REAL NOT NULL,
    "firstEntryHigh" REAL NOT NULL,
    "secondEntryLow" REAL NOT NULL,
    "secondEntryHigh" REAL NOT NULL,
    "chaseLimit" REAL NOT NULL,
    "stopLoss" REAL NOT NULL,
    "firstTarget" REAL NOT NULL,
    "secondTarget" REAL NOT NULL,
    "riskRewardRatio" REAL NOT NULL,
    "suggestedPositionPercent" REAL NOT NULL,
    "thesis" TEXT NOT NULL,
    "reasons" TEXT NOT NULL,
    "warnings" TEXT NOT NULL,
    "invalidReason" TEXT,
    "marketDataMode" TEXT NOT NULL,
    "marketDataSource" TEXT NOT NULL,
    "marketTimestamp" DATETIME NOT NULL,
    "calculatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    "isDemo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "PlanEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradingPlanId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventTime" DATETIME NOT NULL,
    "price" REAL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanEvent_tradingPlanId_fkey" FOREIGN KEY ("tradingPlanId") REFERENCES "TradingPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradingPlanId" TEXT NOT NULL,
    "reviewDate" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "entryPrice" REAL,
    "exitPrice" REAL,
    "highestPrice" REAL,
    "lowestPrice" REAL,
    "returnPercent" REAL NOT NULL,
    "maxFavorableExcursionPercent" REAL NOT NULL,
    "maxAdverseExcursionPercent" REAL NOT NULL,
    "holdingDays" INTEGER NOT NULL,
    "followedPlan" BOOLEAN NOT NULL,
    "executionNotes" TEXT NOT NULL,
    "whatWorked" TEXT NOT NULL,
    "whatFailed" TEXT NOT NULL,
    "lesson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "PlanReview_tradingPlanId_fkey" FOREIGN KEY ("tradingPlanId") REFERENCES "TradingPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SignalSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradingPlanId" TEXT NOT NULL,
    "snapshotTime" DATETIME NOT NULL,
    "quoteJson" TEXT NOT NULL,
    "indicatorsJson" TEXT NOT NULL,
    "shortScoreJson" TEXT NOT NULL,
    "midScoreJson" TEXT NOT NULL,
    "tradeLevelsJson" TEXT NOT NULL,
    "dataStatus" TEXT NOT NULL,
    "dataSource" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SignalSnapshot_tradingPlanId_fkey" FOREIGN KEY ("tradingPlanId") REFERENCES "TradingPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TradingPlan_idempotencyKey_key" ON "TradingPlan"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TradingPlan_code_planDate_idx" ON "TradingPlan"("code", "planDate");

-- CreateIndex
CREATE INDEX "TradingPlan_status_idx" ON "TradingPlan"("status");

-- CreateIndex
CREATE INDEX "TradingPlan_marketDataMode_idx" ON "TradingPlan"("marketDataMode");

-- CreateIndex
CREATE UNIQUE INDEX "TradingPlan_planDate_code_planType_status_key" ON "TradingPlan"("planDate", "code", "planType", "status");

-- CreateIndex
CREATE INDEX "PlanEvent_tradingPlanId_eventTime_idx" ON "PlanEvent"("tradingPlanId", "eventTime");

-- CreateIndex
CREATE UNIQUE INDEX "PlanReview_tradingPlanId_key" ON "PlanReview"("tradingPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "SignalSnapshot_tradingPlanId_key" ON "SignalSnapshot"("tradingPlanId");

