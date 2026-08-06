-- CreateTable
CREATE TABLE "PaperAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountKey" TEXT NOT NULL,
    "initialCashFen" BIGINT NOT NULL,
    "availableCashFen" BIGINT NOT NULL,
    "frozenCashFen" BIGINT NOT NULL,
    "realizedPnlFen" BIGINT NOT NULL,
    "cumulativeFeesFen" BIGINT NOT NULL,
    "accountVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PaperAccountSettingsVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeKey" TEXT NOT NULL,
    "accountId" TEXT,
    "version" INTEGER NOT NULL,
    "initialCashForNewAccountsFen" BIGINT,
    "commissionRatePpm" INTEGER NOT NULL,
    "minimumCommissionFen" BIGINT NOT NULL,
    "stampDutySellRatePpm" INTEGER NOT NULL,
    "transferFeeRatePpm" INTEGER NOT NULL,
    "maxSingleStockBp" INTEGER NOT NULL,
    "maxTotalPositionBp" INTEGER NOT NULL,
    "maxRiskBp" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaperAccountSettingsVersion_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaperPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "sellableQuantity" INTEGER NOT NULL,
    "frozenQuantity" INTEGER NOT NULL,
    "averageCostFen" BIGINT NOT NULL,
    "realizedPnlFen" BIGINT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaperPosition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaperLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "positionId" TEXT NOT NULL,
    "acquiredSequence" INTEGER NOT NULL,
    "acquiredTradingDate" TEXT NOT NULL,
    "sellableTradingDate" TEXT NOT NULL,
    "originalQuantity" INTEGER NOT NULL,
    "remainingQuantity" INTEGER NOT NULL,
    "priceFen" BIGINT NOT NULL,
    "buyFeeFen" BIGINT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaperLot_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "PaperPosition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaperOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "positionId" TEXT,
    "code" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceFen" BIGINT,
    "status" TEXT NOT NULL,
    "riskSnapshotJson" TEXT NOT NULL,
    "settingsVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "confirmedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaperOrder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaperOrder_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "PaperPosition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaperFill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceFen" BIGINT NOT NULL,
    "notionalFen" BIGINT NOT NULL,
    "commissionFen" BIGINT NOT NULL,
    "stampDutyFen" BIGINT NOT NULL,
    "transferFeeFen" BIGINT NOT NULL,
    "tradingDate" TEXT NOT NULL,
    "executedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaperFill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaperOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "orderId" TEXT,
    "sequence" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountFen" BIGINT NOT NULL,
    "balanceAfterFen" BIGINT NOT NULL,
    "idempotencyKey" TEXT,
    "metadataJson" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CashLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaperOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExitRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "positionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "settingsVersion" INTEGER NOT NULL,
    "firstTargetPriceFen" BIGINT NOT NULL,
    "secondTargetPriceFen" BIGINT NOT NULL,
    "stopPriceFen" BIGINT NOT NULL,
    "firstTargetExecutedAt" DATETIME,
    "secondTargetExecutedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "confirmedAt" DATETIME NOT NULL,
    "supersededAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExitRule_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "PaperPosition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaperAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "payloadJson" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaperAuditLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaperWorkerState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastProcessedMinuteAt" DATETIME,
    "lastSuccessfulCheckAt" DATETIME,
    "lastErrorCode" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaperWorkerState_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkerLease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leaseKey" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "acquiredAt" DATETIME NOT NULL,
    "heartbeatAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PaperAccount_accountKey_key" ON "PaperAccount"("accountKey");

-- CreateIndex
CREATE INDEX "PaperAccount_status_createdAt_idx" ON "PaperAccount"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaperAccountSettingsVersion_idempotencyKey_key" ON "PaperAccountSettingsVersion"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaperAccountSettingsVersion_accountId_version_idx" ON "PaperAccountSettingsVersion"("accountId", "version");

-- CreateIndex
CREATE INDEX "PaperAccountSettingsVersion_createdAt_idx" ON "PaperAccountSettingsVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaperAccountSettingsVersion_scopeKey_version_key" ON "PaperAccountSettingsVersion"("scopeKey", "version");

-- CreateIndex
CREATE INDEX "PaperPosition_accountId_updatedAt_idx" ON "PaperPosition"("accountId", "updatedAt");

-- CreateIndex
CREATE INDEX "PaperPosition_code_idx" ON "PaperPosition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaperPosition_accountId_code_key" ON "PaperPosition"("accountId", "code");

-- CreateIndex
CREATE INDEX "PaperLot_positionId_sellableTradingDate_idx" ON "PaperLot"("positionId", "sellableTradingDate");

-- CreateIndex
CREATE INDEX "PaperLot_sellableTradingDate_idx" ON "PaperLot"("sellableTradingDate");

-- CreateIndex
CREATE UNIQUE INDEX "PaperLot_positionId_acquiredSequence_key" ON "PaperLot"("positionId", "acquiredSequence");

-- CreateIndex
CREATE UNIQUE INDEX "PaperOrder_idempotencyKey_key" ON "PaperOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaperOrder_accountId_status_createdAt_idx" ON "PaperOrder"("accountId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PaperOrder_positionId_createdAt_idx" ON "PaperOrder"("positionId", "createdAt");

-- CreateIndex
CREATE INDEX "PaperOrder_code_status_idx" ON "PaperOrder"("code", "status");

-- CreateIndex
CREATE INDEX "PaperFill_tradingDate_executedAt_idx" ON "PaperFill"("tradingDate", "executedAt");

-- CreateIndex
CREATE INDEX "PaperFill_executedAt_idx" ON "PaperFill"("executedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaperFill_orderId_sequence_key" ON "PaperFill"("orderId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "CashLedgerEntry_idempotencyKey_key" ON "CashLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CashLedgerEntry_accountId_occurredAt_idx" ON "CashLedgerEntry"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "CashLedgerEntry_orderId_idx" ON "CashLedgerEntry"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "CashLedgerEntry_accountId_sequence_key" ON "CashLedgerEntry"("accountId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ExitRule_idempotencyKey_key" ON "ExitRule"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ExitRule_positionId_isActive_idx" ON "ExitRule"("positionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ExitRule_positionId_version_key" ON "ExitRule"("positionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PaperAuditLog_idempotencyKey_key" ON "PaperAuditLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaperAuditLog_accountId_occurredAt_idx" ON "PaperAuditLog"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "PaperAuditLog_entityType_entityId_idx" ON "PaperAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "PaperAuditLog_accountId_sequence_key" ON "PaperAuditLog"("accountId", "sequence");

-- CreateIndex
CREATE INDEX "PaperWorkerState_status_lastSuccessfulCheckAt_idx" ON "PaperWorkerState"("status", "lastSuccessfulCheckAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaperWorkerState_accountId_code_key" ON "PaperWorkerState"("accountId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerLease_leaseKey_key" ON "WorkerLease"("leaseKey");

-- CreateIndex
CREATE INDEX "WorkerLease_expiresAt_idx" ON "WorkerLease"("expiresAt");

CREATE TRIGGER "CashLedgerEntry_immutable_update"
BEFORE UPDATE ON "CashLedgerEntry"
BEGIN
  SELECT RAISE(ABORT, 'CASH_LEDGER_ENTRY_IMMUTABLE');
END;

CREATE TRIGGER "CashLedgerEntry_immutable_delete"
BEFORE DELETE ON "CashLedgerEntry"
BEGIN
  SELECT RAISE(ABORT, 'CASH_LEDGER_ENTRY_IMMUTABLE');
END;

CREATE TRIGGER "PaperAuditLog_immutable_update"
BEFORE UPDATE ON "PaperAuditLog"
BEGIN
  SELECT RAISE(ABORT, 'PAPER_AUDIT_LOG_IMMUTABLE');
END;

CREATE TRIGGER "PaperAuditLog_immutable_delete"
BEFORE DELETE ON "PaperAuditLog"
BEGIN
  SELECT RAISE(ABORT, 'PAPER_AUDIT_LOG_IMMUTABLE');
END;

CREATE TRIGGER "PaperFill_immutable_update"
BEFORE UPDATE ON "PaperFill"
BEGIN
  SELECT RAISE(ABORT, 'PAPER_FILL_IMMUTABLE');
END;

CREATE TRIGGER "PaperFill_immutable_delete"
BEFORE DELETE ON "PaperFill"
BEGIN
  SELECT RAISE(ABORT, 'PAPER_FILL_IMMUTABLE');
END;
