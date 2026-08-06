import {
  CashLedgerDirection,
  CashLedgerType,
  PaperAccountStatus,
  PaperOrderSide,
  PaperOrderStatus,
  PaperWorkerStatus,
  PrismaClient,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const fen = (value: string): bigint => BigInt(value);
let sequence = 0;

type SqliteObject = {
  name: string;
  tbl_name: string;
  type: string;
  sql: string | null;
};

type SqliteForeignKey = {
  from: string;
  table: string;
  to: string;
  on_delete: string;
};

function uniqueKey(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

async function createAccount() {
  const accountKey = uniqueKey("account");

  return prisma.paperAccount.create({
    data: {
      accountKey,
      initialCashFen: fen("10000000"),
      availableCashFen: fen("10000000"),
      frozenCashFen: fen("0"),
      realizedPnlFen: fen("0"),
      cumulativeFeesFen: fen("0"),
      accountVersion: 1,
      status: PaperAccountStatus.active,
    },
  });
}

async function createPosition(accountId: string) {
  return prisma.paperPosition.create({
    data: {
      accountId,
      code: uniqueKey("000001"),
      totalQuantity: 100,
      sellableQuantity: 100,
      frozenQuantity: 0,
      averageCostFen: fen("1000"),
      realizedPnlFen: fen("0"),
      version: 1,
    },
  });
}

async function createOrder(accountId: string, positionId?: string) {
  return prisma.paperOrder.create({
    data: {
      accountId,
      positionId,
      code: "000001",
      side: PaperOrderSide.buy,
      quantity: 100,
      priceFen: fen("1000"),
      status: PaperOrderStatus.pending_confirmation,
      riskSnapshotJson: "{}",
      settingsVersion: 1,
      idempotencyKey: uniqueKey("order"),
      version: 1,
    },
  });
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("paper account ledger Prisma schema", () => {
  it("keeps the legacy PaperTrade delegate queryable", async () => {
    await expect(prisma.paperTrade.count()).resolves.toBeTypeOf("number");
  });

  it("creates accounts with bigint cash fields", async () => {
    const account = await createAccount();

    expect(account.status).toBe(PaperAccountStatus.active);
    expect(account.accountVersion).toBe(1);
    expect(account.initialCashFen).toBe(fen("10000000"));
    expect(typeof account.initialCashFen).toBe("bigint");
    expect(typeof account.availableCashFen).toBe("bigint");
    expect(typeof account.frozenCashFen).toBe("bigint");
    expect(typeof account.realizedPnlFen).toBe("bigint");
    expect(typeof account.cumulativeFeesFen).toBe("bigint");
  });

  it("enforces settings version and idempotency uniqueness", async () => {
    const account = await createAccount();
    const scopeKey = `account:${account.id}`;
    const sharedKey = uniqueKey("settings-idempotency");

    const settings = await prisma.paperAccountSettingsVersion.create({
      data: {
        scopeKey,
        accountId: account.id,
        version: 1,
        initialCashForNewAccountsFen: null,
        commissionRatePpm: 250,
        minimumCommissionFen: fen("500"),
        stampDutySellRatePpm: 500,
        transferFeeRatePpm: 10,
        maxSingleStockBp: 3000,
        maxTotalPositionBp: 8000,
        maxRiskBp: 200,
        actorId: "schema-test",
        idempotencyKey: sharedKey,
      },
    });

    expect(typeof settings.minimumCommissionFen).toBe("bigint");
    await expect(
      prisma.paperAccountSettingsVersion.create({
        data: {
          scopeKey,
          accountId: account.id,
          version: 1,
          initialCashForNewAccountsFen: null,
          commissionRatePpm: 250,
          minimumCommissionFen: fen("500"),
          stampDutySellRatePpm: 500,
          transferFeeRatePpm: 10,
          maxSingleStockBp: 3000,
          maxTotalPositionBp: 8000,
          maxRiskBp: 200,
          actorId: "schema-test",
          idempotencyKey: uniqueKey("settings-duplicate-version"),
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.paperAccountSettingsVersion.create({
        data: {
          scopeKey: uniqueKey("settings-scope"),
          accountId: account.id,
          version: 2,
          initialCashForNewAccountsFen: null,
          commissionRatePpm: 250,
          minimumCommissionFen: fen("500"),
          stampDutySellRatePpm: 500,
          transferFeeRatePpm: 10,
          maxSingleStockBp: 3000,
          maxTotalPositionBp: 8000,
          maxRiskBp: 200,
          actorId: "schema-test",
          idempotencyKey: sharedKey,
        },
      }),
    ).rejects.toThrow();

    const defaults = await prisma.paperAccountSettingsVersion.create({
      data: {
        scopeKey: "schema-test-settings-scope",
        accountId: null,
        version: 1,
        initialCashForNewAccountsFen: fen("10000000"),
        commissionRatePpm: 250,
        minimumCommissionFen: fen("500"),
        stampDutySellRatePpm: 500,
        transferFeeRatePpm: 10,
        maxSingleStockBp: 3000,
        maxTotalPositionBp: 8000,
        maxRiskBp: 200,
        actorId: "schema-test",
        idempotencyKey: null,
      },
    });

    expect(defaults.accountId).toBeNull();
    expect(typeof defaults.initialCashForNewAccountsFen).toBe("bigint");
  });

  it("enforces one position per account and code", async () => {
    const account = await createAccount();
    const position = await createPosition(account.id);

    expect(typeof position.averageCostFen).toBe("bigint");
    expect(typeof position.realizedPnlFen).toBe("bigint");
    expect(typeof position.totalQuantity).toBe("number");
    expect(typeof position.version).toBe("number");
    await expect(
      prisma.paperPosition.create({
        data: {
          accountId: account.id,
          code: position.code,
          totalQuantity: 0,
          sellableQuantity: 0,
          frozenQuantity: 0,
          averageCostFen: fen("0"),
          realizedPnlFen: fen("0"),
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces unique lot acquisition sequences per position", async () => {
    const account = await createAccount();
    const position = await createPosition(account.id);
    const lot = await prisma.paperLot.create({
      data: {
        positionId: position.id,
        acquiredSequence: 1,
        acquiredTradingDate: "2026-08-03",
        sellableTradingDate: "2026-08-04",
        originalQuantity: 100,
        remainingQuantity: 100,
        priceFen: fen("1000"),
        buyFeeFen: fen("500"),
      },
    });

    expect(typeof lot.priceFen).toBe("bigint");
    expect(typeof lot.buyFeeFen).toBe("bigint");
    expect(typeof lot.acquiredSequence).toBe("number");
    expect(typeof lot.originalQuantity).toBe("number");
    expect(typeof lot.remainingQuantity).toBe("number");
    await expect(
      prisma.paperLot.create({
        data: {
          positionId: position.id,
          acquiredSequence: 1,
          acquiredTradingDate: "2026-08-03",
          sellableTradingDate: "2026-08-04",
          originalQuantity: 100,
          remainingQuantity: 100,
          priceFen: fen("1000"),
          buyFeeFen: fen("500"),
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces non-null order idempotency keys and preserves field types", async () => {
    const account = await createAccount();
    const order = await createOrder(account.id);

    expect(order.status).toBe(PaperOrderStatus.pending_confirmation);
    expect(typeof order.quantity).toBe("number");
    expect(typeof order.priceFen).toBe("bigint");
    expect(typeof order.riskSnapshotJson).toBe("string");
    expect(typeof order.version).toBe("number");
    const orderWithNullPrice = await prisma.paperOrder.create({
      data: {
        accountId: account.id,
        code: "000001",
        side: PaperOrderSide.buy,
        quantity: 100,
        priceFen: null,
        status: PaperOrderStatus.pending_confirmation,
        riskSnapshotJson: "{}",
        settingsVersion: 1,
        idempotencyKey: uniqueKey("order-null-price"),
      },
    });

    expect(orderWithNullPrice.priceFen).toBeNull();
    await expect(
      prisma.paperOrder.create({
        data: {
          accountId: account.id,
          code: "000001",
          side: PaperOrderSide.buy,
          quantity: 100,
          priceFen: null,
          status: PaperOrderStatus.pending_confirmation,
          riskSnapshotJson: "{}",
          settingsVersion: 1,
          idempotencyKey: order.idempotencyKey,
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces fill sequences and preserves bigint fee details", async () => {
    const account = await createAccount();
    const order = await createOrder(account.id);
    const fill = await prisma.paperFill.create({
      data: {
        orderId: order.id,
        sequence: 1,
        quantity: 100,
        priceFen: fen("1000"),
        notionalFen: fen("100000"),
        commissionFen: fen("500"),
        stampDutyFen: fen("0"),
        transferFeeFen: fen("1"),
        tradingDate: "2026-08-03",
        executedAt: new Date("2026-08-03T00:00:00.000Z"),
      },
    });

    expect(typeof fill.priceFen).toBe("bigint");
    expect(typeof fill.notionalFen).toBe("bigint");
    expect(typeof fill.commissionFen).toBe("bigint");
    expect(typeof fill.stampDutyFen).toBe("bigint");
    expect(typeof fill.transferFeeFen).toBe("bigint");
    expect(typeof fill.quantity).toBe("number");
    expect(typeof fill.sequence).toBe("number");
    await expect(
      prisma.paperFill.create({
        data: {
          orderId: order.id,
          sequence: 1,
          quantity: 1,
          priceFen: fen("1"),
          notionalFen: fen("1"),
          commissionFen: fen("0"),
          stampDutyFen: fen("0"),
          transferFeeFen: fen("0"),
          tradingDate: "2026-08-03",
          executedAt: new Date("2026-08-03T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces ledger uniqueness while allowing multiple null idempotency keys", async () => {
    const account = await createAccount();
    const idempotencyKey = uniqueKey("ledger");
    const entry = await prisma.cashLedgerEntry.create({
      data: {
        accountId: account.id,
        sequence: 1,
        direction: CashLedgerDirection.credit,
        type: CashLedgerType.initial_cash,
        amountFen: fen("10000000"),
        balanceAfterFen: fen("10000000"),
        idempotencyKey,
        metadataJson: "{}",
        occurredAt: new Date("2026-08-03T00:00:00.000Z"),
      },
    });

    expect(typeof entry.amountFen).toBe("bigint");
    await expect(
      prisma.cashLedgerEntry.create({
        data: {
          accountId: account.id,
          sequence: 2,
          direction: CashLedgerDirection.credit,
          type: CashLedgerType.cash_adjustment,
          amountFen: fen("1"),
          balanceAfterFen: fen("10000001"),
          idempotencyKey,
          occurredAt: new Date("2026-08-03T00:00:01.000Z"),
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.cashLedgerEntry.create({
        data: {
          accountId: account.id,
          sequence: 1,
          direction: CashLedgerDirection.credit,
          type: CashLedgerType.cash_adjustment,
          amountFen: fen("1"),
          balanceAfterFen: fen("10000001"),
          idempotencyKey: uniqueKey("ledger-sequence"),
          occurredAt: new Date("2026-08-03T00:00:01.000Z"),
        },
      }),
    ).rejects.toThrow();
    await prisma.cashLedgerEntry.create({
      data: {
        accountId: account.id,
        sequence: 3,
        direction: CashLedgerDirection.credit,
        type: CashLedgerType.cash_adjustment,
        amountFen: fen("1"),
        balanceAfterFen: fen("10000001"),
        idempotencyKey: null,
        occurredAt: new Date("2026-08-03T00:00:02.000Z"),
      },
    });
    await expect(
      prisma.cashLedgerEntry.create({
        data: {
          accountId: account.id,
          sequence: 4,
          direction: CashLedgerDirection.credit,
          type: CashLedgerType.cash_adjustment,
          amountFen: fen("1"),
          balanceAfterFen: fen("10000002"),
          idempotencyKey: null,
          occurredAt: new Date("2026-08-03T00:00:03.000Z"),
        },
      }),
    ).resolves.toMatchObject({ sequence: 4 });
  });

  it("enforces exit rule versions", async () => {
    const account = await createAccount();
    const position = await createPosition(account.id);
    const rule = await prisma.exitRule.create({
      data: {
        positionId: position.id,
        version: 1,
        settingsVersion: 1,
        firstTargetPriceFen: fen("1200"),
        secondTargetPriceFen: fen("1400"),
        stopPriceFen: fen("900"),
        actorId: "schema-test",
        idempotencyKey: uniqueKey("exit-rule"),
        confirmedAt: new Date("2026-08-03T00:00:00.000Z"),
      },
    });

    expect(typeof rule.firstTargetPriceFen).toBe("bigint");
    expect(typeof rule.secondTargetPriceFen).toBe("bigint");
    expect(typeof rule.stopPriceFen).toBe("bigint");
    expect(typeof rule.version).toBe("number");
    expect(typeof rule.settingsVersion).toBe("number");
    await expect(
      prisma.exitRule.create({
        data: {
          positionId: position.id,
          version: 1,
          settingsVersion: 1,
          firstTargetPriceFen: fen("1200"),
          secondTargetPriceFen: fen("1400"),
          stopPriceFen: fen("900"),
          actorId: "schema-test",
          idempotencyKey: uniqueKey("exit-rule-duplicate"),
          confirmedAt: new Date("2026-08-03T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces audit uniqueness while allowing multiple null idempotency keys", async () => {
    const account = await createAccount();
    const idempotencyKey = uniqueKey("audit");
    const audit = await prisma.paperAuditLog.create({
      data: {
        accountId: account.id,
        sequence: 1,
        action: "schema_test",
        actorId: "schema-test",
        entityType: "PaperAccount",
        entityId: account.id,
        payloadJson: "{}",
        idempotencyKey,
        occurredAt: new Date("2026-08-03T00:00:00.000Z"),
      },
    });

    expect(typeof audit.payloadJson).toBe("string");
    await expect(
      prisma.paperAuditLog.create({
        data: {
          accountId: account.id,
          sequence: 2,
          action: "schema_test",
          actorId: "schema-test",
          entityType: "PaperAccount",
          payloadJson: "{}",
          idempotencyKey,
          occurredAt: new Date("2026-08-03T00:00:01.000Z"),
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.paperAuditLog.create({
        data: {
          accountId: account.id,
          sequence: 1,
          action: "schema_test",
          actorId: "schema-test",
          entityType: "PaperAccount",
          payloadJson: "{}",
          idempotencyKey: uniqueKey("audit-sequence"),
          occurredAt: new Date("2026-08-03T00:00:01.000Z"),
        },
      }),
    ).rejects.toThrow();
    await prisma.paperAuditLog.create({
      data: {
        accountId: account.id,
        sequence: 3,
        action: "schema_test",
        actorId: "schema-test",
        entityType: "PaperAccount",
        payloadJson: "{}",
        idempotencyKey: null,
        occurredAt: new Date("2026-08-03T00:00:02.000Z"),
      },
    });
    await expect(
      prisma.paperAuditLog.create({
        data: {
          accountId: account.id,
          sequence: 4,
          action: "schema_test",
          actorId: "schema-test",
          entityType: "PaperAccount",
          payloadJson: "{}",
          idempotencyKey: null,
          occurredAt: new Date("2026-08-03T00:00:03.000Z"),
        },
      }),
    ).resolves.toMatchObject({ sequence: 4 });
  });

  it("enforces worker state and lease uniqueness", async () => {
    const account = await createAccount();
    const state = await prisma.paperWorkerState.create({
      data: {
        accountId: account.id,
        code: "000001",
        status: PaperWorkerStatus.idle,
        lastProcessedMinuteAt: null,
        lastSuccessfulCheckAt: null,
        version: 1,
      },
    });

    expect(state.lastProcessedMinuteAt).toBeNull();
    expect(state.lastSuccessfulCheckAt).toBeNull();
    expect(typeof state.version).toBe("number");
    await expect(
      prisma.paperWorkerState.create({
        data: {
          accountId: account.id,
          code: "000001",
          status: PaperWorkerStatus.idle,
        },
      }),
    ).rejects.toThrow();

    const heartbeatAt = new Date("2026-08-03T00:00:00.000Z");
    const expiresAt = new Date("2026-08-03T00:00:45.000Z");
    const lease = await prisma.workerLease.create({
      data: {
        leaseKey: uniqueKey("lease"),
        ownerId: "schema-test-worker",
        acquiredAt: heartbeatAt,
        heartbeatAt,
        expiresAt,
        version: 1,
      },
    });

    expect(lease.expiresAt > lease.heartbeatAt).toBe(true);
    expect(lease.acquiredAt).toBeInstanceOf(Date);
    expect(lease.heartbeatAt).toBeInstanceOf(Date);
    expect(lease.expiresAt).toBeInstanceOf(Date);
    expect(typeof lease.version).toBe("number");
    await expect(
      prisma.workerLease.create({
        data: {
          leaseKey: lease.leaseKey,
          ownerId: "schema-test-worker",
          acquiredAt: heartbeatAt,
          heartbeatAt,
          expiresAt,
        },
      }),
    ).rejects.toThrow();
  });

  it("restricts account deletion when history exists", async () => {
    const account = await createAccount();
    await prisma.cashLedgerEntry.create({
      data: {
        accountId: account.id,
        sequence: 1,
        direction: CashLedgerDirection.credit,
        type: CashLedgerType.initial_cash,
        amountFen: fen("10000000"),
        balanceAfterFen: fen("10000000"),
        occurredAt: new Date("2026-08-03T00:00:00.000Z"),
      },
    });

    await expect(
      prisma.paperAccount.delete({ where: { id: account.id } }),
    ).rejects.toThrow();
  });

  it("rejects updates and deletes for immutable history tables", async () => {
    const account = await createAccount();
    const order = await createOrder(account.id);
    const fill = await prisma.paperFill.create({
      data: {
        orderId: order.id,
        sequence: 1,
        quantity: 100,
        priceFen: fen("1000"),
        notionalFen: fen("100000"),
        commissionFen: fen("500"),
        stampDutyFen: fen("0"),
        transferFeeFen: fen("1"),
        tradingDate: "2026-08-03",
        executedAt: new Date("2026-08-03T00:00:00.000Z"),
      },
    });
    const ledger = await prisma.cashLedgerEntry.create({
      data: {
        accountId: account.id,
        orderId: order.id,
        sequence: 1,
        direction: CashLedgerDirection.debit,
        type: CashLedgerType.buy_settlement,
        amountFen: fen("100501"),
        balanceAfterFen: fen("9899499"),
        occurredAt: new Date("2026-08-03T00:00:00.000Z"),
      },
    });
    const audit = await prisma.paperAuditLog.create({
      data: {
        accountId: account.id,
        sequence: 1,
        action: "order_filled",
        actorId: "schema-test",
        entityType: "PaperOrder",
        entityId: order.id,
        payloadJson: "{}",
        occurredAt: new Date("2026-08-03T00:00:00.000Z"),
      },
    });

    await expect(
      prisma.cashLedgerEntry.update({
        where: { id: ledger.id },
        data: { metadataJson: "{\"changed\":true}" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(
        "UPDATE CashLedgerEntry SET metadataJson = ? WHERE id = ?",
        "{\"changed\":true}",
        ledger.id,
      ),
    ).rejects.toThrow("CASH_LEDGER_ENTRY_IMMUTABLE");
    await expect(
      prisma.cashLedgerEntry.delete({ where: { id: ledger.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(
        "DELETE FROM CashLedgerEntry WHERE id = ?",
        ledger.id,
      ),
    ).rejects.toThrow("CASH_LEDGER_ENTRY_IMMUTABLE");
    await expect(
      prisma.paperAuditLog.update({
        where: { id: audit.id },
        data: { payloadJson: "{\"changed\":true}" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(
        "UPDATE PaperAuditLog SET payloadJson = ? WHERE id = ?",
        "{\"changed\":true}",
        audit.id,
      ),
    ).rejects.toThrow("PAPER_AUDIT_LOG_IMMUTABLE");
    await expect(
      prisma.paperAuditLog.delete({ where: { id: audit.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(
        "DELETE FROM PaperAuditLog WHERE id = ?",
        audit.id,
      ),
    ).rejects.toThrow("PAPER_AUDIT_LOG_IMMUTABLE");
    await expect(
      prisma.paperFill.update({
        where: { id: fill.id },
        data: { quantity: 99 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(
        "UPDATE PaperFill SET quantity = ? WHERE id = ?",
        99,
        fill.id,
      ),
    ).rejects.toThrow("PAPER_FILL_IMMUTABLE");
    await expect(
      prisma.paperFill.delete({ where: { id: fill.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe("DELETE FROM PaperFill WHERE id = ?", fill.id),
    ).rejects.toThrow("PAPER_FILL_IMMUTABLE");
  });

  it("creates all expected SQLite objects with restricted foreign keys", async () => {
    const expectedTables = [
      "PaperAccount",
      "PaperAccountSettingsVersion",
      "PaperPosition",
      "PaperLot",
      "PaperOrder",
      "PaperFill",
      "CashLedgerEntry",
      "ExitRule",
      "PaperAuditLog",
      "PaperWorkerState",
      "WorkerLease",
    ];
    const objects = await prisma.$queryRawUnsafe<SqliteObject[]>(
      "SELECT name, tbl_name, type, sql FROM sqlite_master",
    );
    const tableNames = new Set(
      objects.filter((object) => object.type === "table").map((object) => object.name),
    );
    const indexes = objects.filter(
      (object) =>
        object.type === "index" &&
        expectedTables.includes(object.tbl_name) &&
        object.sql !== null,
    );
    const triggers = objects.filter(
      (object) => object.type === "trigger" && expectedTables.includes(object.tbl_name),
    );

    for (const tableName of expectedTables) {
      expect(tableNames.has(tableName)).toBe(true);
    }
    expect(tableNames.has("PaperTrade")).toBe(true);
    const uniqueIndexNames = indexes
      .filter((index) => index.sql?.startsWith("CREATE UNIQUE INDEX"))
      .map((index) => index.name)
      .sort();
    const regularIndexNames = indexes
      .filter((index) => index.sql?.startsWith("CREATE INDEX"))
      .map((index) => index.name)
      .sort();

    expect(uniqueIndexNames).toEqual([
      "CashLedgerEntry_accountId_sequence_key",
      "CashLedgerEntry_idempotencyKey_key",
      "ExitRule_idempotencyKey_key",
      "ExitRule_positionId_version_key",
      "PaperAccountSettingsVersion_idempotencyKey_key",
      "PaperAccountSettingsVersion_scopeKey_version_key",
      "PaperAccount_accountKey_key",
      "PaperAuditLog_accountId_sequence_key",
      "PaperAuditLog_idempotencyKey_key",
      "PaperFill_orderId_sequence_key",
      "PaperLot_positionId_acquiredSequence_key",
      "PaperOrder_idempotencyKey_key",
      "PaperPosition_accountId_code_key",
      "PaperWorkerState_accountId_code_key",
      "WorkerLease_leaseKey_key",
    ]);
    expect(regularIndexNames).toEqual([
      "CashLedgerEntry_accountId_occurredAt_idx",
      "CashLedgerEntry_orderId_idx",
      "ExitRule_positionId_isActive_idx",
      "PaperAccountSettingsVersion_accountId_version_idx",
      "PaperAccountSettingsVersion_createdAt_idx",
      "PaperAccount_status_createdAt_idx",
      "PaperAuditLog_accountId_occurredAt_idx",
      "PaperAuditLog_entityType_entityId_idx",
      "PaperFill_executedAt_idx",
      "PaperFill_tradingDate_executedAt_idx",
      "PaperLot_positionId_sellableTradingDate_idx",
      "PaperLot_sellableTradingDate_idx",
      "PaperOrder_accountId_status_createdAt_idx",
      "PaperOrder_code_status_idx",
      "PaperOrder_positionId_createdAt_idx",
      "PaperPosition_accountId_updatedAt_idx",
      "PaperPosition_code_idx",
      "PaperWorkerState_status_lastSuccessfulCheckAt_idx",
      "WorkerLease_expiresAt_idx",
    ]);
    expect(triggers.map((trigger) => trigger.name).sort()).toEqual([
      "CashLedgerEntry_immutable_delete",
      "CashLedgerEntry_immutable_update",
      "PaperAuditLog_immutable_delete",
      "PaperAuditLog_immutable_update",
      "PaperFill_immutable_delete",
      "PaperFill_immutable_update",
    ]);

    const sourceTables = [
      "PaperAccountSettingsVersion",
      "PaperPosition",
      "PaperLot",
      "PaperOrder",
      "PaperFill",
      "CashLedgerEntry",
      "ExitRule",
      "PaperAuditLog",
      "PaperWorkerState",
    ];
    const foreignKeys = (
      await Promise.all(
        sourceTables.map(async (sourceTable) => {
          const rows = await prisma.$queryRawUnsafe<SqliteForeignKey[]>(
            `PRAGMA foreign_key_list("${sourceTable}")`,
          );

          return rows.map((row) => ({
            sourceTable,
            sourceColumn: row.from,
            targetTable: row.table,
            targetColumn: row.to,
            onDelete: row.on_delete,
          }));
        }),
      )
    ).flat();

    expect(
      foreignKeys
        .map(
          (foreignKey) =>
            `${foreignKey.sourceTable}.${foreignKey.sourceColumn}->${foreignKey.targetTable}.${foreignKey.targetColumn}:${foreignKey.onDelete}`,
        )
        .sort(),
    ).toEqual([
      "CashLedgerEntry.accountId->PaperAccount.id:RESTRICT",
      "CashLedgerEntry.orderId->PaperOrder.id:RESTRICT",
      "ExitRule.positionId->PaperPosition.id:RESTRICT",
      "PaperAccountSettingsVersion.accountId->PaperAccount.id:RESTRICT",
      "PaperAuditLog.accountId->PaperAccount.id:RESTRICT",
      "PaperFill.orderId->PaperOrder.id:RESTRICT",
      "PaperLot.positionId->PaperPosition.id:RESTRICT",
      "PaperOrder.accountId->PaperAccount.id:RESTRICT",
      "PaperOrder.positionId->PaperPosition.id:RESTRICT",
      "PaperPosition.accountId->PaperAccount.id:RESTRICT",
      "PaperWorkerState.accountId->PaperAccount.id:RESTRICT",
    ]);
  });
});
