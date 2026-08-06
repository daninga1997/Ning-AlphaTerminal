import {
  Prisma,
  type CashLedgerEntry,
  type ExitRule,
  type PaperAccount,
  type PaperAccountSettingsVersion,
  type PaperAuditLog,
  type PaperFill,
  type PaperLot,
  type PaperOrder,
  type PaperPosition,
  type PaperWorkerState,
  type WorkerLease,
} from "@prisma/client";

import type {
  CashLedgerEntryInput,
  CashLedgerEntryRecord,
  CreateExitRuleInput,
  CreatePaperAccountInput,
  CreatePaperFillInput,
  CreatePaperLotInput,
  CreatePaperOrderInput,
  CreatePaperPositionInput,
  ExitRuleRecord,
  PaperAccountRecord,
  PaperAccountSettingsVersionInput,
  PaperAccountSettingsVersionRecord,
  PaperAuditLogInput,
  PaperAuditLogRecord,
  PaperFillRecord,
  PaperLotRecord,
  PaperOrderRecord,
  PaperPositionRecord,
  PaperWorkerStateRecord,
  UpdatePaperAccountCashInput,
  UpdatePaperOrderStatusInput,
  UpdatePaperPositionInput,
  UpsertPaperWorkerStateInput,
  WorkerLeaseRecord,
} from "./paper-account-repositories";
import type { PaperAccountTransactionContext } from "./paper-account-unit-of-work";

export type PaperAccountTransactionClient = Prisma.TransactionClient;

export type PaperAccountTransactionScope = {
  active: boolean;
};

const canonicalIsoDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function assertTransactionScopeActive(
  scope: PaperAccountTransactionScope,
): void {
  if (!scope.active) {
    throw new Error("PAPER_ACCOUNT_TRANSACTION_CONTEXT_CLOSED");
  }
}

function parseIsoDateTime(value: string): Date {
  if (
    typeof value !== "string" ||
    !canonicalIsoDateTimePattern.test(value)
  ) {
    throw new Error("PAPER_ACCOUNT_DATE_INVALID");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error("PAPER_ACCOUNT_DATE_INVALID");
  }

  return parsed;
}

function assertTradingDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match === null) {
    throw new Error("PAPER_ACCOUNT_TRADING_DATE_INVALID");
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("PAPER_ACCOUNT_TRADING_DATE_INVALID");
  }

  return value;
}

function assertSafeNonNegativeInteger(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("PAPER_ACCOUNT_INTEGER_INVALID");
  }
}

function assertSafePositiveInteger(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("PAPER_ACCOUNT_INTEGER_INVALID");
  }
}

function isKnownRequestError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function isIdempotencyKeyConflict(error: unknown): boolean {
  if (!isKnownRequestError(error) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  const targets =
    typeof target === "string"
      ? [target]
      : Array.isArray(target)
        ? target.filter((entry): entry is string => typeof entry === "string")
        : [];

  return targets.some((entry) => entry.includes("idempotencyKey"));
}

function isUniqueConflict(error: unknown): boolean {
  return isKnownRequestError(error) && error.code === "P2002";
}

function mapPaperAccount(value: PaperAccount): PaperAccountRecord {
  return {
    id: value.id,
    accountKey: value.accountKey,
    initialCashFen: value.initialCashFen,
    availableCashFen: value.availableCashFen,
    frozenCashFen: value.frozenCashFen,
    realizedPnlFen: value.realizedPnlFen,
    cumulativeFeesFen: value.cumulativeFeesFen,
    accountVersion: value.accountVersion,
    status: value.status,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function mapSettingsVersion(
  value: PaperAccountSettingsVersion,
): PaperAccountSettingsVersionRecord {
  return {
    id: value.id,
    scopeKey: value.scopeKey,
    accountId: value.accountId,
    version: value.version,
    initialCashForNewAccountsFen: value.initialCashForNewAccountsFen,
    commissionRatePpm: value.commissionRatePpm,
    minimumCommissionFen: value.minimumCommissionFen,
    stampDutySellRatePpm: value.stampDutySellRatePpm,
    transferFeeRatePpm: value.transferFeeRatePpm,
    maxSingleStockBp: value.maxSingleStockBp,
    maxTotalPositionBp: value.maxTotalPositionBp,
    maxRiskBp: value.maxRiskBp,
    actorId: value.actorId,
    idempotencyKey: value.idempotencyKey,
    createdAt: value.createdAt.toISOString(),
  };
}

function mapPosition(value: PaperPosition): PaperPositionRecord {
  return {
    id: value.id,
    accountId: value.accountId,
    code: value.code,
    totalQuantity: value.totalQuantity,
    sellableQuantity: value.sellableQuantity,
    frozenQuantity: value.frozenQuantity,
    averageCostFen: value.averageCostFen,
    realizedPnlFen: value.realizedPnlFen,
    version: value.version,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function mapLot(value: PaperLot): PaperLotRecord {
  return {
    id: value.id,
    positionId: value.positionId,
    acquiredSequence: value.acquiredSequence,
    acquiredTradingDate: value.acquiredTradingDate,
    sellableTradingDate: value.sellableTradingDate,
    originalQuantity: value.originalQuantity,
    remainingQuantity: value.remainingQuantity,
    priceFen: value.priceFen,
    buyFeeFen: value.buyFeeFen,
    createdAt: value.createdAt.toISOString(),
  };
}

function mapOrder(value: PaperOrder): PaperOrderRecord {
  return {
    id: value.id,
    accountId: value.accountId,
    positionId: value.positionId,
    code: value.code,
    side: value.side,
    quantity: value.quantity,
    priceFen: value.priceFen,
    status: value.status,
    riskSnapshotJson: value.riskSnapshotJson,
    settingsVersion: value.settingsVersion,
    idempotencyKey: value.idempotencyKey,
    version: value.version,
    confirmedAt: value.confirmedAt?.toISOString() ?? null,
    completedAt: value.completedAt?.toISOString() ?? null,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function mapFill(value: PaperFill): PaperFillRecord {
  return {
    id: value.id,
    orderId: value.orderId,
    sequence: value.sequence,
    quantity: value.quantity,
    priceFen: value.priceFen,
    notionalFen: value.notionalFen,
    commissionFen: value.commissionFen,
    stampDutyFen: value.stampDutyFen,
    transferFeeFen: value.transferFeeFen,
    tradingDate: value.tradingDate,
    executedAt: value.executedAt.toISOString(),
    createdAt: value.createdAt.toISOString(),
  };
}

function mapLedgerEntry(value: CashLedgerEntry): CashLedgerEntryRecord {
  return {
    id: value.id,
    accountId: value.accountId,
    orderId: value.orderId,
    sequence: value.sequence,
    direction: value.direction,
    type: value.type,
    amountFen: value.amountFen,
    balanceAfterFen: value.balanceAfterFen,
    idempotencyKey: value.idempotencyKey,
    metadataJson: value.metadataJson,
    occurredAt: value.occurredAt.toISOString(),
    createdAt: value.createdAt.toISOString(),
  };
}

function mapExitRule(value: ExitRule): ExitRuleRecord {
  return {
    id: value.id,
    positionId: value.positionId,
    version: value.version,
    settingsVersion: value.settingsVersion,
    firstTargetPriceFen: value.firstTargetPriceFen,
    secondTargetPriceFen: value.secondTargetPriceFen,
    stopPriceFen: value.stopPriceFen,
    firstTargetExecutedAt: value.firstTargetExecutedAt?.toISOString() ?? null,
    secondTargetExecutedAt: value.secondTargetExecutedAt?.toISOString() ?? null,
    isActive: value.isActive,
    actorId: value.actorId,
    idempotencyKey: value.idempotencyKey,
    confirmedAt: value.confirmedAt.toISOString(),
    supersededAt: value.supersededAt?.toISOString() ?? null,
    createdAt: value.createdAt.toISOString(),
  };
}

function mapAuditLog(value: PaperAuditLog): PaperAuditLogRecord {
  return {
    id: value.id,
    accountId: value.accountId,
    sequence: value.sequence,
    action: value.action,
    actorId: value.actorId,
    entityType: value.entityType,
    entityId: value.entityId,
    payloadJson: value.payloadJson,
    idempotencyKey: value.idempotencyKey,
    occurredAt: value.occurredAt.toISOString(),
    createdAt: value.createdAt.toISOString(),
  };
}

function mapWorkerState(value: PaperWorkerState): PaperWorkerStateRecord {
  return {
    id: value.id,
    accountId: value.accountId,
    code: value.code,
    status: value.status,
    lastProcessedMinuteAt: value.lastProcessedMinuteAt?.toISOString() ?? null,
    lastSuccessfulCheckAt: value.lastSuccessfulCheckAt?.toISOString() ?? null,
    lastErrorCode: value.lastErrorCode,
    version: value.version,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function mapWorkerLease(value: WorkerLease): WorkerLeaseRecord {
  return {
    id: value.id,
    leaseKey: value.leaseKey,
    ownerId: value.ownerId,
    acquiredAt: value.acquiredAt.toISOString(),
    heartbeatAt: value.heartbeatAt.toISOString(),
    expiresAt: value.expiresAt.toISOString(),
    version: value.version,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function assertInputNonNegativeIntegers(values: number[]): void {
  for (const value of values) {
    assertSafeNonNegativeInteger(value);
  }
}

function assertInputPositiveIntegers(values: number[]): void {
  for (const value of values) {
    assertSafePositiveInteger(value);
  }
}

export function createPrismaPaperAccountRepositories(
  client: PaperAccountTransactionClient,
  scope: PaperAccountTransactionScope,
): PaperAccountTransactionContext {
  return {
    accounts: {
      async findById(accountId) {
        assertTransactionScopeActive(scope);
        const found = await client.paperAccount.findUnique({ where: { id: accountId } });
        return found === null ? null : mapPaperAccount(found);
      },
      async findByKey(accountKey) {
        assertTransactionScopeActive(scope);
        const found = await client.paperAccount.findUnique({ where: { accountKey } });
        return found === null ? null : mapPaperAccount(found);
      },
      async create(input: CreatePaperAccountInput) {
        assertTransactionScopeActive(scope);
        const created = await client.paperAccount.create({
          data: {
            accountKey: input.accountKey,
            initialCashFen: input.initialCashFen,
            availableCashFen: input.initialCashFen,
            frozenCashFen: BigInt("0"),
            realizedPnlFen: BigInt("0"),
            cumulativeFeesFen: BigInt("0"),
            accountVersion: 1,
            status: input.status,
          },
        });
        return mapPaperAccount(created);
      },
      async updateCash(input: UpdatePaperAccountCashInput) {
        assertTransactionScopeActive(scope);
        assertSafePositiveInteger(input.expectedAccountVersion);
        const data: Prisma.PaperAccountUpdateManyMutationInput = {
          availableCashFen: input.availableCashFen,
          frozenCashFen: input.frozenCashFen,
          accountVersion: { increment: 1 },
        };

        if (input.realizedPnlFen !== undefined) {
          data.realizedPnlFen = input.realizedPnlFen;
        }
        if (input.cumulativeFeesFen !== undefined) {
          data.cumulativeFeesFen = input.cumulativeFeesFen;
        }

        const result = await client.paperAccount.updateMany({
          where: { id: input.accountId, accountVersion: input.expectedAccountVersion },
          data,
        });
        if (result.count !== 1) {
          throw new Error("ACCOUNT_VERSION_CONFLICT");
        }
        const updated = await client.paperAccount.findUnique({
          where: { id: input.accountId },
        });
        if (updated === null) {
          throw new Error("ACCOUNT_VERSION_CONFLICT");
        }
        return mapPaperAccount(updated);
      },
    },
    settings: {
      async findLatestByScope(scopeKey) {
        assertTransactionScopeActive(scope);
        const found = await client.paperAccountSettingsVersion.findFirst({
          where: { scopeKey },
          orderBy: { version: "desc" },
        });
        return found === null ? null : mapSettingsVersion(found);
      },
      async listByScope(scopeKey) {
        assertTransactionScopeActive(scope);
        const found = await client.paperAccountSettingsVersion.findMany({
          where: { scopeKey },
          orderBy: { version: "asc" },
        });
        return found.map(mapSettingsVersion);
      },
      async findByIdempotencyKey(idempotencyKey) {
        assertTransactionScopeActive(scope);
        const found = await client.paperAccountSettingsVersion.findUnique({
          where: { idempotencyKey },
        });
        return found === null ? null : mapSettingsVersion(found);
      },
      async append(input: PaperAccountSettingsVersionInput) {
        assertTransactionScopeActive(scope);
        assertSafePositiveInteger(input.version);
        assertInputNonNegativeIntegers([
          input.commissionRatePpm,
          input.stampDutySellRatePpm,
          input.transferFeeRatePpm,
          input.maxSingleStockBp,
          input.maxTotalPositionBp,
          input.maxRiskBp,
        ]);
        try {
          const created = await client.paperAccountSettingsVersion.create({
            data: {
              scopeKey: input.scopeKey,
              accountId: input.accountId,
              version: input.version,
              initialCashForNewAccountsFen: input.initialCashForNewAccountsFen,
              commissionRatePpm: input.commissionRatePpm,
              minimumCommissionFen: input.minimumCommissionFen,
              stampDutySellRatePpm: input.stampDutySellRatePpm,
              transferFeeRatePpm: input.transferFeeRatePpm,
              maxSingleStockBp: input.maxSingleStockBp,
              maxTotalPositionBp: input.maxTotalPositionBp,
              maxRiskBp: input.maxRiskBp,
              actorId: input.actorId,
              idempotencyKey: input.idempotencyKey,
              createdAt: parseIsoDateTime(input.occurredAt),
            },
          });
          return mapSettingsVersion(created);
        } catch (error) {
          if (isIdempotencyKeyConflict(error)) {
            throw new Error("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
          }
          throw error;
        }
      },
    },
    positions: {
      async findByAccountAndCode(accountId, code) {
        assertTransactionScopeActive(scope);
        const found = await client.paperPosition.findUnique({
          where: { accountId_code: { accountId, code } },
        });
        return found === null ? null : mapPosition(found);
      },
      async listByAccount(accountId) {
        assertTransactionScopeActive(scope);
        const found = await client.paperPosition.findMany({
          where: { accountId },
          orderBy: { code: "asc" },
        });
        return found.map(mapPosition);
      },
      async create(input: CreatePaperPositionInput) {
        assertTransactionScopeActive(scope);
        assertInputNonNegativeIntegers([
          input.totalQuantity,
          input.sellableQuantity,
          input.frozenQuantity,
        ]);
        const created = await client.paperPosition.create({ data: input });
        return mapPosition(created);
      },
      async updateWithVersion(input: UpdatePaperPositionInput) {
        assertTransactionScopeActive(scope);
        assertInputNonNegativeIntegers([
          input.totalQuantity,
          input.sellableQuantity,
          input.frozenQuantity,
        ]);
        assertSafePositiveInteger(input.expectedVersion);
        const result = await client.paperPosition.updateMany({
          where: { id: input.positionId, version: input.expectedVersion },
          data: {
            totalQuantity: input.totalQuantity,
            sellableQuantity: input.sellableQuantity,
            frozenQuantity: input.frozenQuantity,
            averageCostFen: input.averageCostFen,
            realizedPnlFen: input.realizedPnlFen,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new Error("POSITION_VERSION_CONFLICT");
        }
        const updated = await client.paperPosition.findUnique({
          where: { id: input.positionId },
        });
        if (updated === null) {
          throw new Error("POSITION_VERSION_CONFLICT");
        }
        return mapPosition(updated);
      },
    },
    lots: {
      async listByPosition(positionId) {
        assertTransactionScopeActive(scope);
        const found = await client.paperLot.findMany({
          where: { positionId },
          orderBy: { acquiredSequence: "asc" },
        });
        return found.map(mapLot);
      },
      async listSellableByPosition(positionId, tradingDate) {
        assertTransactionScopeActive(scope);
        assertTradingDate(tradingDate);
        const found = await client.paperLot.findMany({
          where: {
            positionId,
            sellableTradingDate: { lte: tradingDate },
            remainingQuantity: { gt: 0 },
          },
          orderBy: { acquiredSequence: "asc" },
        });
        return found.map(mapLot);
      },
      async append(input: CreatePaperLotInput) {
        assertTransactionScopeActive(scope);
        assertSafePositiveInteger(input.acquiredSequence);
        assertInputNonNegativeIntegers([
          input.originalQuantity,
          input.remainingQuantity,
        ]);
        assertTradingDate(input.acquiredTradingDate);
        assertTradingDate(input.sellableTradingDate);
        const created = await client.paperLot.create({ data: input });
        return mapLot(created);
      },
      async updateRemainingQuantity(input) {
        assertTransactionScopeActive(scope);
        assertInputNonNegativeIntegers([input.remainingQuantity, input.expectedRemainingQuantity]);
        const result = await client.paperLot.updateMany({
          where: {
            id: input.lotId,
            remainingQuantity: input.expectedRemainingQuantity,
          },
          data: { remainingQuantity: input.remainingQuantity },
        });
        if (result.count !== 1) {
          throw new Error("LOT_REMAINING_QUANTITY_CONFLICT");
        }
        const updated = await client.paperLot.findUnique({
          where: { id: input.lotId },
        });
        if (updated === null) {
          throw new Error("LOT_REMAINING_QUANTITY_CONFLICT");
        }
        return mapLot(updated);
      },
    },
    orders: {
      async findById(orderId) {
        assertTransactionScopeActive(scope);
        const found = await client.paperOrder.findUnique({ where: { id: orderId } });
        return found === null ? null : mapOrder(found);
      },
      async findByIdempotencyKey(idempotencyKey) {
        assertTransactionScopeActive(scope);
        const found = await client.paperOrder.findUnique({
          where: { idempotencyKey },
        });
        return found === null ? null : mapOrder(found);
      },
      async listByAccount(accountId) {
        assertTransactionScopeActive(scope);
        const found = await client.paperOrder.findMany({
          where: { accountId },
          orderBy: { createdAt: "asc" },
        });
        return found.map(mapOrder);
      },
      async append(input: CreatePaperOrderInput) {
        assertTransactionScopeActive(scope);
        assertSafeNonNegativeInteger(input.quantity);
        assertSafePositiveInteger(input.settingsVersion);
        try {
          const created = await client.paperOrder.create({
            data: {
              accountId: input.accountId,
              positionId: input.positionId,
              code: input.code,
              side: input.side,
              quantity: input.quantity,
              priceFen: input.priceFen,
              status: input.status,
              riskSnapshotJson: input.riskSnapshotJson,
              settingsVersion: input.settingsVersion,
              idempotencyKey: input.idempotencyKey,
              confirmedAt:
                input.confirmedAt === null
                  ? null
                  : parseIsoDateTime(input.confirmedAt),
              completedAt:
                input.completedAt === null
                  ? null
                  : parseIsoDateTime(input.completedAt),
            },
          });
          return mapOrder(created);
        } catch (error) {
          if (isIdempotencyKeyConflict(error)) {
            throw new Error("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
          }
          throw error;
        }
      },
      async updateStatusWithVersion(input: UpdatePaperOrderStatusInput) {
        assertTransactionScopeActive(scope);
        assertSafePositiveInteger(input.expectedVersion);
        const data: Prisma.PaperOrderUpdateManyMutationInput = {
          status: input.toStatus,
          version: { increment: 1 },
        };

        if (Object.prototype.hasOwnProperty.call(input, "confirmedAt")) {
          data.confirmedAt =
            input.confirmedAt === null
              ? null
              : parseIsoDateTime(input.confirmedAt ?? "");
        }
        if (Object.prototype.hasOwnProperty.call(input, "completedAt")) {
          data.completedAt =
            input.completedAt === null
              ? null
              : parseIsoDateTime(input.completedAt ?? "");
        }

        const result = await client.paperOrder.updateMany({
          where: {
            id: input.orderId,
            status: input.fromStatus,
            version: input.expectedVersion,
          },
          data,
        });
        if (result.count !== 1) {
          throw new Error("ORDER_VERSION_CONFLICT");
        }
        const updated = await client.paperOrder.findUnique({
          where: { id: input.orderId },
        });
        if (updated === null) {
          throw new Error("ORDER_VERSION_CONFLICT");
        }
        return mapOrder(updated);
      },
    },
    fills: {
      async findByOrderAndSequence(orderId, sequence) {
        assertTransactionScopeActive(scope);
        assertSafePositiveInteger(sequence);
        const found = await client.paperFill.findUnique({
          where: { orderId_sequence: { orderId, sequence } },
        });
        return found === null ? null : mapFill(found);
      },
      async listByOrder(orderId) {
        assertTransactionScopeActive(scope);
        const found = await client.paperFill.findMany({
          where: { orderId },
          orderBy: { sequence: "asc" },
        });
        return found.map(mapFill);
      },
      async listByAccount(accountId) {
        assertTransactionScopeActive(scope);
        const found = await client.paperFill.findMany({
          where: { order: { accountId } },
          orderBy: [{ executedAt: "asc" }, { sequence: "asc" }],
        });
        return found.map(mapFill);
      },
      async append(input: CreatePaperFillInput) {
        assertTransactionScopeActive(scope);
        assertSafePositiveInteger(input.sequence);
        assertSafeNonNegativeInteger(input.quantity);
        assertTradingDate(input.tradingDate);
        const created = await client.paperFill.create({
          data: { ...input, executedAt: parseIsoDateTime(input.executedAt) },
        });
        return mapFill(created);
      },
    },
    ledger: {
      async findByIdempotencyKey(idempotencyKey) {
        assertTransactionScopeActive(scope);
        const found = await client.cashLedgerEntry.findUnique({
          where: { idempotencyKey },
        });
        return found === null ? null : mapLedgerEntry(found);
      },
      async listByAccount(accountId) {
        assertTransactionScopeActive(scope);
        const found = await client.cashLedgerEntry.findMany({
          where: { accountId },
          orderBy: { sequence: "asc" },
        });
        return found.map(mapLedgerEntry);
      },
      async sumByAccount(accountId) {
        assertTransactionScopeActive(scope);
        const [credits, debits] = await Promise.all([
          client.cashLedgerEntry.aggregate({
            where: { accountId, direction: "credit" },
            _sum: { amountFen: true },
          }),
          client.cashLedgerEntry.aggregate({
            where: { accountId, direction: "debit" },
            _sum: { amountFen: true },
          }),
        ]);
        const creditsFen = credits._sum.amountFen ?? BigInt("0");
        const debitsFen = debits._sum.amountFen ?? BigInt("0");
        return { creditsFen, debitsFen, netFen: creditsFen - debitsFen };
      },
      async append(input: CashLedgerEntryInput) {
        assertTransactionScopeActive(scope);
        assertSafePositiveInteger(input.sequence);
        try {
          const created = await client.cashLedgerEntry.create({
            data: { ...input, occurredAt: parseIsoDateTime(input.occurredAt) },
          });
          return mapLedgerEntry(created);
        } catch (error) {
          if (isIdempotencyKeyConflict(error)) {
            throw new Error("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
          }
          throw error;
        }
      },
    },
    exitRules: {
      async findActiveByPosition(positionId) {
        assertTransactionScopeActive(scope);
        const found = await client.exitRule.findFirst({
          where: { positionId, isActive: true },
          orderBy: { version: "desc" },
        });
        return found === null ? null : mapExitRule(found);
      },
      async listByPosition(positionId) {
        assertTransactionScopeActive(scope);
        const found = await client.exitRule.findMany({
          where: { positionId },
          orderBy: { version: "asc" },
        });
        return found.map(mapExitRule);
      },
      async append(input: CreateExitRuleInput) {
        assertTransactionScopeActive(scope);
        assertInputPositiveIntegers([input.version, input.settingsVersion]);
        try {
          const created = await client.exitRule.create({
            data: {
              positionId: input.positionId,
              version: input.version,
              settingsVersion: input.settingsVersion,
              firstTargetPriceFen: input.firstTargetPriceFen,
              secondTargetPriceFen: input.secondTargetPriceFen,
              stopPriceFen: input.stopPriceFen,
              firstTargetExecutedAt: null,
              secondTargetExecutedAt: null,
              isActive: true,
              actorId: input.actorId,
              idempotencyKey: input.idempotencyKey,
              confirmedAt: parseIsoDateTime(input.confirmedAt),
              supersededAt: null,
            },
          });
          return mapExitRule(created);
        } catch (error) {
          if (isIdempotencyKeyConflict(error)) {
            throw new Error("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
          }
          throw error;
        }
      },
      async supersede(input) {
        assertTransactionScopeActive(scope);
        assertSafePositiveInteger(input.expectedVersion);
        const result = await client.exitRule.updateMany({
          where: {
            id: input.ruleId,
            version: input.expectedVersion,
            isActive: true,
          },
          data: { isActive: false, supersededAt: parseIsoDateTime(input.supersededAt) },
        });
        if (result.count !== 1) {
          throw new Error("EXIT_RULE_VERSION_CONFLICT");
        }
        const updated = await client.exitRule.findUnique({
          where: { id: input.ruleId },
        });
        if (updated === null) {
          throw new Error("EXIT_RULE_VERSION_CONFLICT");
        }
        return mapExitRule(updated);
      },
    },
    audit: {
      async findByIdempotencyKey(idempotencyKey) {
        assertTransactionScopeActive(scope);
        const found = await client.paperAuditLog.findUnique({
          where: { idempotencyKey },
        });
        return found === null ? null : mapAuditLog(found);
      },
      async listByAccount(accountId) {
        assertTransactionScopeActive(scope);
        const found = await client.paperAuditLog.findMany({
          where: { accountId },
          orderBy: { sequence: "asc" },
        });
        return found.map(mapAuditLog);
      },
      async append(input: PaperAuditLogInput) {
        assertTransactionScopeActive(scope);
        assertSafePositiveInteger(input.sequence);
        try {
          const created = await client.paperAuditLog.create({
            data: { ...input, occurredAt: parseIsoDateTime(input.occurredAt) },
          });
          return mapAuditLog(created);
        } catch (error) {
          if (isIdempotencyKeyConflict(error)) {
            throw new Error("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
          }
          throw error;
        }
      },
    },
    workerStates: {
      async findByAccountAndCode(accountId, code) {
        assertTransactionScopeActive(scope);
        const found = await client.paperWorkerState.findUnique({
          where: { accountId_code: { accountId, code } },
        });
        return found === null ? null : mapWorkerState(found);
      },
      async listByAccount(accountId) {
        assertTransactionScopeActive(scope);
        const found = await client.paperWorkerState.findMany({
          where: { accountId },
          orderBy: { code: "asc" },
        });
        return found.map(mapWorkerState);
      },
      async upsertWithVersion(input: UpsertPaperWorkerStateInput) {
        assertTransactionScopeActive(scope);
        if (input.expectedVersion === null) {
          try {
            const created = await client.paperWorkerState.create({
              data: {
                accountId: input.accountId,
                code: input.code,
                status: input.status,
                lastProcessedMinuteAt:
                  input.lastProcessedMinuteAt === null
                    ? null
                    : parseIsoDateTime(input.lastProcessedMinuteAt),
                lastSuccessfulCheckAt:
                  input.lastSuccessfulCheckAt === null
                    ? null
                    : parseIsoDateTime(input.lastSuccessfulCheckAt),
                lastErrorCode: input.lastErrorCode,
                version: 1,
              },
            });
            return mapWorkerState(created);
          } catch (error) {
            if (isUniqueConflict(error)) {
              throw new Error("WORKER_STATE_VERSION_CONFLICT");
            }
            throw error;
          }
        }

        assertSafePositiveInteger(input.expectedVersion);
        const result = await client.paperWorkerState.updateMany({
          where: {
            accountId: input.accountId,
            code: input.code,
            version: input.expectedVersion,
          },
          data: {
            status: input.status,
            lastProcessedMinuteAt:
              input.lastProcessedMinuteAt === null
                ? null
                : parseIsoDateTime(input.lastProcessedMinuteAt),
            lastSuccessfulCheckAt:
              input.lastSuccessfulCheckAt === null
                ? null
                : parseIsoDateTime(input.lastSuccessfulCheckAt),
            lastErrorCode: input.lastErrorCode,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new Error("WORKER_STATE_VERSION_CONFLICT");
        }
        const updated = await client.paperWorkerState.findUnique({
          where: { accountId_code: { accountId: input.accountId, code: input.code } },
        });
        if (updated === null) {
          throw new Error("WORKER_STATE_VERSION_CONFLICT");
        }
        return mapWorkerState(updated);
      },
    },
    leases: {
      async findByKey(leaseKey) {
        assertTransactionScopeActive(scope);
        const found = await client.workerLease.findUnique({ where: { leaseKey } });
        return found === null ? null : mapWorkerLease(found);
      },
      async acquire(input) {
        assertTransactionScopeActive(scope);
        const existing = await client.workerLease.findUnique({
          where: { leaseKey: input.leaseKey },
        });
        if (existing === null) {
          const created = await client.workerLease.create({
            data: {
              leaseKey: input.leaseKey,
              ownerId: input.ownerId,
              acquiredAt: parseIsoDateTime(input.acquiredAt),
              heartbeatAt: parseIsoDateTime(input.heartbeatAt),
              expiresAt: parseIsoDateTime(input.expiresAt),
              version: 1,
            },
          });
          return mapWorkerLease(created);
        }
        const acquiredAt = parseIsoDateTime(input.acquiredAt);
        if (existing.expiresAt > acquiredAt) {
          throw new Error("WORKER_LEASE_VERSION_CONFLICT");
        }
        const result = await client.workerLease.updateMany({
          where: {
            leaseKey: input.leaseKey,
            version: existing.version,
          },
          data: {
            ownerId: input.ownerId,
            acquiredAt,
            heartbeatAt: parseIsoDateTime(input.heartbeatAt),
            expiresAt: parseIsoDateTime(input.expiresAt),
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new Error("WORKER_LEASE_VERSION_CONFLICT");
        }
        const updated = await client.workerLease.findUnique({
          where: { leaseKey: input.leaseKey },
        });
        if (updated === null) {
          throw new Error("WORKER_LEASE_VERSION_CONFLICT");
        }
        return mapWorkerLease(updated);
      },
      async heartbeat(input) {
        assertTransactionScopeActive(scope);
        assertSafePositiveInteger(input.expectedVersion);
        const result = await client.workerLease.updateMany({
          where: {
            leaseKey: input.leaseKey,
            ownerId: input.ownerId,
            version: input.expectedVersion,
          },
          data: {
            heartbeatAt: parseIsoDateTime(input.heartbeatAt),
            expiresAt: parseIsoDateTime(input.expiresAt),
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new Error("WORKER_LEASE_VERSION_CONFLICT");
        }
        const updated = await client.workerLease.findUnique({
          where: { leaseKey: input.leaseKey },
        });
        if (updated === null) {
          throw new Error("WORKER_LEASE_VERSION_CONFLICT");
        }
        return mapWorkerLease(updated);
      },
      async release(input) {
        assertTransactionScopeActive(scope);
        assertSafePositiveInteger(input.expectedVersion);
        const releasedAt = parseIsoDateTime(input.releasedAt);
        const result = await client.workerLease.updateMany({
          where: {
            leaseKey: input.leaseKey,
            ownerId: input.ownerId,
            version: input.expectedVersion,
          },
          data: {
            heartbeatAt: releasedAt,
            expiresAt: releasedAt,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new Error("WORKER_LEASE_VERSION_CONFLICT");
        }
        const updated = await client.workerLease.findUnique({
          where: { leaseKey: input.leaseKey },
        });
        if (updated === null) {
          throw new Error("WORKER_LEASE_VERSION_CONFLICT");
        }
        return mapWorkerLease(updated);
      },
    },
  };
}
