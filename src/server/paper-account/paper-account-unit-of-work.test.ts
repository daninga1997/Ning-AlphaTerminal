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

import {
  createPrismaPaperAccountUnitOfWork,
} from "./prisma-paper-account-unit-of-work";

const prisma = new PrismaClient();
const unitOfWork = createPrismaPaperAccountUnitOfWork(prisma);
let sequence = 0;

function uniqueKey(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

function iso(offsetSeconds = 0): string {
  return new Date(
    Date.UTC(2026, 7, 4, 0, 0, offsetSeconds),
  ).toISOString();
}

async function createAccount(accountKey = uniqueKey("account")) {
  return unitOfWork.run((context) =>
    context.accounts.create({
      accountKey,
      initialCashFen: BigInt("10000000"),
      status: PaperAccountStatus.active,
    }),
  );
}

async function createSettings(accountId: string) {
  return unitOfWork.run((context) =>
    context.settings.append({
      scopeKey: `account:${accountId}`,
      accountId,
      version: 1,
      initialCashForNewAccountsFen: null,
      commissionRatePpm: 250,
      minimumCommissionFen: BigInt("500"),
      stampDutySellRatePpm: 500,
      transferFeeRatePpm: 10,
      maxSingleStockBp: 3000,
      maxTotalPositionBp: 8000,
      maxRiskBp: 200,
      actorId: "transaction-test",
      occurredAt: iso(),
      idempotencyKey: uniqueKey("settings"),
    }),
  );
}

async function createPosition(accountId: string, code = "600519") {
  return unitOfWork.run((context) =>
    context.positions.create({
      accountId,
      code,
      totalQuantity: 100,
      sellableQuantity: 0,
      frozenQuantity: 0,
      averageCostFen: BigInt("150000"),
      realizedPnlFen: BigInt("0"),
    }),
  );
}

async function createOrder(accountId: string, positionId: string | null = null) {
  return unitOfWork.run((context) =>
    context.orders.append({
      accountId,
      positionId,
      code: "600519",
      side: PaperOrderSide.buy,
      quantity: 100,
      priceFen: null,
      status: PaperOrderStatus.pending_confirmation,
      riskSnapshotJson: "{}",
      settingsVersion: 1,
      idempotencyKey: uniqueKey("order"),
      confirmedAt: null,
      completedAt: null,
    }),
  );
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("paper account transaction repositories", () => {
  it("rolls back account, settings, ledger, and audit writes when work fails", async () => {
    const accountKey = uniqueKey("rollback-account");
    const settingsKey = uniqueKey("rollback-settings");
    const ledgerKey = uniqueKey("rollback-ledger");
    const auditKey = uniqueKey("rollback-audit");

    await expect(
      unitOfWork.run(async (context) => {
        const account = await context.accounts.create({
          accountKey,
          initialCashFen: BigInt("10000000"),
          status: PaperAccountStatus.active,
        });
        await context.settings.append({
          scopeKey: `account:${account.id}`,
          accountId: account.id,
          version: 1,
          initialCashForNewAccountsFen: null,
          commissionRatePpm: 250,
          minimumCommissionFen: BigInt("500"),
          stampDutySellRatePpm: 500,
          transferFeeRatePpm: 10,
          maxSingleStockBp: 3000,
          maxTotalPositionBp: 8000,
          maxRiskBp: 200,
          actorId: "transaction-test",
          occurredAt: iso(),
          idempotencyKey: settingsKey,
        });
        await context.ledger.append({
          accountId: account.id,
          orderId: null,
          sequence: 1,
          direction: CashLedgerDirection.credit,
          type: CashLedgerType.initial_cash,
          amountFen: BigInt("10000000"),
          balanceAfterFen: BigInt("10000000"),
          idempotencyKey: ledgerKey,
          metadataJson: '{"reason":"test opening","actorId":"transaction-test"}',
          occurredAt: iso(),
        });
        await context.audit.append({
          accountId: account.id,
          sequence: 1,
          action: "account_initialized",
          actorId: "transaction-test",
          entityType: "PaperAccount",
          entityId: account.id,
          payloadJson: "{}",
          idempotencyKey: auditKey,
          occurredAt: iso(),
        });
        throw new Error("ROLLBACK_FOR_TEST");
      }),
    ).rejects.toThrow("ROLLBACK_FOR_TEST");

    expect(await prisma.paperAccount.findUnique({ where: { accountKey } })).toBeNull();
    expect(
      await prisma.paperAccountSettingsVersion.findUnique({
        where: { idempotencyKey: settingsKey },
      }),
    ).toBeNull();
    expect(
      await prisma.cashLedgerEntry.findUnique({
        where: { idempotencyKey: ledgerKey },
      }),
    ).toBeNull();
    expect(
      await prisma.paperAuditLog.findUnique({
        where: { idempotencyKey: auditKey },
      }),
    ).toBeNull();
  });

  it("commits account, settings, ledger, and audit writes together", async () => {
    const result = await unitOfWork.run(async (context) => {
      const account = await context.accounts.create({
        accountKey: uniqueKey("commit-account"),
        initialCashFen: BigInt("10000000"),
        status: PaperAccountStatus.active,
      });
      const settings = await context.settings.append({
        scopeKey: `account:${account.id}`,
        accountId: account.id,
        version: 1,
        initialCashForNewAccountsFen: null,
        commissionRatePpm: 250,
        minimumCommissionFen: BigInt("500"),
        stampDutySellRatePpm: 500,
        transferFeeRatePpm: 10,
        maxSingleStockBp: 3000,
        maxTotalPositionBp: 8000,
        maxRiskBp: 200,
        actorId: "transaction-test",
        occurredAt: iso(),
        idempotencyKey: uniqueKey("commit-settings"),
      });
      const ledger = await context.ledger.append({
        accountId: account.id,
        orderId: null,
        sequence: 1,
        direction: CashLedgerDirection.credit,
        type: CashLedgerType.initial_cash,
        amountFen: BigInt("10000000"),
        balanceAfterFen: BigInt("10000000"),
        idempotencyKey: uniqueKey("commit-ledger"),
        metadataJson: null,
        occurredAt: iso(),
      });
      const audit = await context.audit.append({
        accountId: account.id,
        sequence: 1,
        action: "account_initialized",
        actorId: "transaction-test",
        entityType: "PaperAccount",
        entityId: account.id,
        payloadJson: "{}",
        idempotencyKey: uniqueKey("commit-audit"),
        occurredAt: iso(),
      });

      return { accountId: account.id, settingsId: settings.id, ledgerId: ledger.id, auditId: audit.id };
    });

    const [account, settings, ledger, audit] = await Promise.all([
      prisma.paperAccount.findUnique({ where: { id: result.accountId } }),
      prisma.paperAccountSettingsVersion.findUnique({ where: { id: result.settingsId } }),
      prisma.cashLedgerEntry.findUnique({ where: { id: result.ledgerId } }),
      prisma.paperAuditLog.findUnique({ where: { id: result.auditId } }),
    ]);

    expect(account?.initialCashFen).toBe(BigInt("10000000"));
    expect(settings?.accountId).toBe(result.accountId);
    expect(ledger?.accountId).toBe(result.accountId);
    expect(audit?.accountId).toBe(result.accountId);
    expect(typeof account?.initialCashFen).toBe("bigint");
  });

  it("exposes exactly eleven repositories in a transaction context", async () => {
    await unitOfWork.run(async (context) => {
      expect(Object.keys(context).sort()).toEqual([
        "accounts",
        "audit",
        "exitRules",
        "fills",
        "leases",
        "ledger",
        "lots",
        "orders",
        "positions",
        "settings",
        "workerStates",
      ]);
    });
  });

  it("rejects repository reads and writes after the transaction closes", async () => {
    const { accounts, ledger, leases } = await unitOfWork.run(async (context) => ({
      accounts: context.accounts,
      ledger: context.ledger,
      leases: context.leases,
    }));

    await expect(accounts.findByKey("missing")).rejects.toThrow(
      "PAPER_ACCOUNT_TRANSACTION_CONTEXT_CLOSED",
    );
    await expect(ledger.listByAccount("missing")).rejects.toThrow(
      "PAPER_ACCOUNT_TRANSACTION_CONTEXT_CLOSED",
    );
    await expect(leases.findByKey("missing")).rejects.toThrow(
      "PAPER_ACCOUNT_TRANSACTION_CONTEXT_CLOSED",
    );
    await expect(
      accounts.create({
        accountKey: uniqueKey("closed-account"),
        initialCashFen: BigInt("10000000"),
        status: PaperAccountStatus.active,
      }),
    ).rejects.toThrow("PAPER_ACCOUNT_TRANSACTION_CONTEXT_CLOSED");
  });

  it("returns the transaction callback value without wrapping it", async () => {
    const marker = { accountId: uniqueKey("result"), marker: "committed" };
    await expect(unitOfWork.run(async () => marker)).resolves.toBe(marker);
  });

  it("updates account cash with a version compare-and-swap", async () => {
    const account = await createAccount();
    const updated = await unitOfWork.run((context) =>
      context.accounts.updateCash({
        accountId: account.id,
        availableCashFen: BigInt("9000000"),
        frozenCashFen: BigInt("1000000"),
        expectedAccountVersion: 1,
      }),
    );

    expect(updated.availableCashFen).toBe(BigInt("9000000"));
    expect(updated.frozenCashFen).toBe(BigInt("1000000"));
    expect(updated.accountVersion).toBe(2);
    await expect(
      unitOfWork.run((context) =>
        context.accounts.updateCash({
          accountId: account.id,
          availableCashFen: BigInt("8000000"),
          frozenCashFen: BigInt("2000000"),
          expectedAccountVersion: 1,
        }),
      ),
    ).rejects.toThrow("ACCOUNT_VERSION_CONFLICT");
    await expect(prisma.paperAccount.findUnique({ where: { id: account.id } })).resolves.toMatchObject({
      availableCashFen: BigInt("9000000"),
      accountVersion: 2,
    });
  });

  it("maps account money to bigint and dates to ISO strings", async () => {
    const account = await createAccount();
    const found = await unitOfWork.run((context) => context.accounts.findById(account.id));

    expect(found).not.toBeNull();
    expect(typeof found?.initialCashFen).toBe("bigint");
    expect(typeof found?.availableCashFen).toBe("bigint");
    expect(typeof found?.createdAt).toBe("string");
    expect(typeof found?.updatedAt).toBe("string");
    expect(found?.createdAt).not.toBeInstanceOf(Date);
    expect(() => JSON.stringify(found)).toThrow();
  });

  it("finds idempotent settings, ledger, and audit records and reports duplicate keys", async () => {
    const account = await createAccount();
    const settingsKey = uniqueKey("idempotent-settings");
    const ledgerKey = uniqueKey("idempotent-ledger");
    const auditKey = uniqueKey("idempotent-audit");

    await unitOfWork.run(async (context) => {
      await context.settings.append({
        scopeKey: `account:${account.id}`,
        accountId: account.id,
        version: 1,
        initialCashForNewAccountsFen: null,
        commissionRatePpm: 250,
        minimumCommissionFen: BigInt("500"),
        stampDutySellRatePpm: 500,
        transferFeeRatePpm: 10,
        maxSingleStockBp: 3000,
        maxTotalPositionBp: 8000,
        maxRiskBp: 200,
        actorId: "test",
        occurredAt: iso(),
        idempotencyKey: settingsKey,
      });
      await context.ledger.append({
        accountId: account.id,
        orderId: null,
        sequence: 1,
        direction: CashLedgerDirection.credit,
        type: CashLedgerType.initial_cash,
        amountFen: BigInt("10000000"),
        balanceAfterFen: BigInt("10000000"),
        idempotencyKey: ledgerKey,
        metadataJson: null,
        occurredAt: iso(),
      });
      await context.audit.append({
        accountId: account.id,
        sequence: 1,
        action: "created",
        actorId: "test",
        entityType: "PaperAccount",
        entityId: account.id,
        payloadJson: "{}",
        idempotencyKey: auditKey,
        occurredAt: iso(),
      });
      await expect(context.settings.findByIdempotencyKey(settingsKey)).resolves.toMatchObject({ idempotencyKey: settingsKey });
      await expect(context.settings.findLatestByScope(`account:${account.id}`)).resolves.toMatchObject({ version: 1 });
      await expect(context.settings.listByScope(`account:${account.id}`)).resolves.toHaveLength(1);
      await expect(context.ledger.findByIdempotencyKey(ledgerKey)).resolves.toMatchObject({ idempotencyKey: ledgerKey });
      await expect(context.ledger.listByAccount(account.id)).resolves.toHaveLength(1);
      await expect(context.audit.findByIdempotencyKey(auditKey)).resolves.toMatchObject({ idempotencyKey: auditKey });
      await expect(context.audit.listByAccount(account.id)).resolves.toHaveLength(1);
    });

    await expect(
      unitOfWork.run((context) =>
        context.settings.append({
          scopeKey: uniqueKey("duplicate-settings-scope"),
          accountId: account.id,
          version: 1,
          initialCashForNewAccountsFen: null,
          commissionRatePpm: 250,
          minimumCommissionFen: BigInt("500"),
          stampDutySellRatePpm: 500,
          transferFeeRatePpm: 10,
          maxSingleStockBp: 3000,
          maxTotalPositionBp: 8000,
          maxRiskBp: 200,
          actorId: "test",
          occurredAt: iso(),
          idempotencyKey: settingsKey,
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
    await expect(
      unitOfWork.run((context) =>
        context.ledger.append({
          accountId: account.id,
          orderId: null,
          sequence: 2,
          direction: CashLedgerDirection.credit,
          type: CashLedgerType.cash_adjustment,
          amountFen: BigInt("1"),
          balanceAfterFen: BigInt("10000001"),
          idempotencyKey: ledgerKey,
          metadataJson: null,
          occurredAt: iso(),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
    await expect(
      unitOfWork.run((context) =>
        context.audit.append({
          accountId: account.id,
          sequence: 2,
          action: "duplicate",
          actorId: "test",
          entityType: "PaperAccount",
          entityId: account.id,
          payloadJson: "{}",
          idempotencyKey: auditKey,
          occurredAt: iso(),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
  });

  it("sums credit and debit ledger entries as bigint", async () => {
    const account = await createAccount();
    const total = await unitOfWork.run(async (context) => {
      await context.ledger.append({
        accountId: account.id,
        orderId: null,
        sequence: 1,
        direction: CashLedgerDirection.credit,
        type: CashLedgerType.initial_cash,
        amountFen: BigInt("10000000"),
        balanceAfterFen: BigInt("10000000"),
        idempotencyKey: uniqueKey("sum-credit"),
        metadataJson: null,
        occurredAt: iso(),
      });
      await context.ledger.append({
        accountId: account.id,
        orderId: null,
        sequence: 2,
        direction: CashLedgerDirection.debit,
        type: CashLedgerType.fee,
        amountFen: BigInt("1000000"),
        balanceAfterFen: BigInt("9000000"),
        idempotencyKey: uniqueKey("sum-debit-one"),
        metadataJson: null,
        occurredAt: iso(1),
      });
      await context.ledger.append({
        accountId: account.id,
        orderId: null,
        sequence: 3,
        direction: CashLedgerDirection.debit,
        type: CashLedgerType.fee,
        amountFen: BigInt("500"),
        balanceAfterFen: BigInt("8999500"),
        idempotencyKey: uniqueKey("sum-debit-two"),
        metadataJson: null,
        occurredAt: iso(2),
      });
      return context.ledger.sumByAccount(account.id);
    });

    expect(total).toEqual({
      creditsFen: BigInt("10000000"),
      debitsFen: BigInt("1000500"),
      netFen: BigInt("8999500"),
    });
    expect(typeof total.creditsFen).toBe("bigint");
    expect(typeof total.debitsFen).toBe("bigint");
    expect(typeof total.netFen).toBe("bigint");
  });

  it("creates, lists, and compare-and-swaps positions", async () => {
    const account = await createAccount();
    const positionB = await createPosition(account.id, "600519");
    const positionA = await createPosition(account.id, "000001");
    const listed = await unitOfWork.run((context) => context.positions.listByAccount(account.id));

    expect(listed.map((position) => position.code)).toEqual(["000001", "600519"]);
    expect(typeof positionB.averageCostFen).toBe("bigint");
    expect(typeof positionB.createdAt).toBe("string");
    await expect(
      unitOfWork.run((context) => context.positions.findByAccountAndCode(account.id, positionA.code)),
    ).resolves.toMatchObject({ id: positionA.id, version: 1 });
    const updated = await unitOfWork.run((context) =>
      context.positions.updateWithVersion({
        positionId: positionB.id,
        totalQuantity: 100,
        sellableQuantity: 100,
        frozenQuantity: 0,
        averageCostFen: BigInt("150000"),
        realizedPnlFen: BigInt("0"),
        expectedVersion: 1,
      }),
    );
    expect(updated.version).toBe(2);
    await expect(
      unitOfWork.run((context) =>
        context.positions.updateWithVersion({
          positionId: positionB.id,
          totalQuantity: 100,
          sellableQuantity: 0,
          frozenQuantity: 100,
          averageCostFen: BigInt("150000"),
          realizedPnlFen: BigInt("0"),
          expectedVersion: 1,
        }),
      ),
    ).rejects.toThrow("POSITION_VERSION_CONFLICT");
  });

  it("keeps zero-quantity lots, filters sellable lots, and uses remaining quantity CAS", async () => {
    const account = await createAccount();
    const position = await createPosition(account.id);
    const [first, second] = await unitOfWork.run(async (context) => {
      const firstLot = await context.lots.append({
        positionId: position.id,
        acquiredSequence: 1,
        acquiredTradingDate: "2026-08-03",
        sellableTradingDate: "2026-08-04",
        originalQuantity: 100,
        remainingQuantity: 100,
        priceFen: BigInt("150000"),
        buyFeeFen: BigInt("500"),
      });
      const secondLot = await context.lots.append({
        positionId: position.id,
        acquiredSequence: 2,
        acquiredTradingDate: "2026-08-04",
        sellableTradingDate: "2026-08-05",
        originalQuantity: 100,
        remainingQuantity: 100,
        priceFen: BigInt("151000"),
        buyFeeFen: BigInt("500"),
      });
      return [firstLot, secondLot];
    });
    await expect(
      unitOfWork.run((context) => context.lots.listByPosition(position.id)),
    ).resolves.toMatchObject([{ id: first.id }, { id: second.id }]);
    await expect(
      unitOfWork.run((context) => context.lots.listSellableByPosition(position.id, "2026-08-04")),
    ).resolves.toMatchObject([{ id: first.id }]);
    const remaining = await unitOfWork.run((context) =>
      context.lots.updateRemainingQuantity({
        lotId: first.id,
        remainingQuantity: 40,
        expectedRemainingQuantity: 100,
      }),
    );
    expect(remaining.remainingQuantity).toBe(40);
    await expect(
      unitOfWork.run((context) =>
        context.lots.updateRemainingQuantity({
          lotId: first.id,
          remainingQuantity: 0,
          expectedRemainingQuantity: 100,
        }),
      ),
    ).rejects.toThrow("LOT_REMAINING_QUANTITY_CONFLICT");
    await unitOfWork.run((context) =>
      context.lots.updateRemainingQuantity({
        lotId: first.id,
        remainingQuantity: 0,
        expectedRemainingQuantity: 40,
      }),
    );
    await expect(
      unitOfWork.run((context) => context.lots.listByPosition(position.id)),
    ).resolves.toHaveLength(2);
    await expect(
      unitOfWork.run((context) => context.lots.listSellableByPosition(position.id, "2026-08-04")),
    ).resolves.toEqual([]);
  });

  it("rejects invalid trading dates before writing lots", async () => {
    const account = await createAccount();
    const position = await createPosition(account.id);

    for (const invalidDate of ["2026-02-30", "2026-8-04", "not-a-date"]) {
      await expect(
        unitOfWork.run((context) =>
          context.lots.append({
            positionId: position.id,
            acquiredSequence: 1,
            acquiredTradingDate: invalidDate,
            sellableTradingDate: "2026-08-04",
            originalQuantity: 100,
            remainingQuantity: 100,
            priceFen: BigInt("150000"),
            buyFeeFen: BigInt("500"),
          }),
        ),
      ).rejects.toThrow("PAPER_ACCOUNT_TRADING_DATE_INVALID");
    }
  });

  it("updates order status atomically and preserves optional timestamps", async () => {
    const account = await createAccount();
    const order = await createOrder(account.id);
    const confirmedAt = iso();
    const updated = await unitOfWork.run((context) =>
      context.orders.updateStatusWithVersion({
        orderId: order.id,
        fromStatus: PaperOrderStatus.pending_confirmation,
        toStatus: PaperOrderStatus.confirmed,
        expectedVersion: 1,
        confirmedAt,
      }),
    );

    expect(updated.status).toBe(PaperOrderStatus.confirmed);
    expect(updated.version).toBe(2);
    expect(updated.confirmedAt).toBe(confirmedAt);
    expect(updated.completedAt).toBeNull();
    await expect(
      unitOfWork.run((context) =>
        context.orders.updateStatusWithVersion({
          orderId: order.id,
          fromStatus: PaperOrderStatus.pending_confirmation,
          toStatus: PaperOrderStatus.filled,
          expectedVersion: 1,
        }),
      ),
    ).rejects.toThrow("ORDER_VERSION_CONFLICT");
  });

  it("maps order idempotency conflicts and lists fills by order and account", async () => {
    const account = await createAccount();
    const idempotencyKey = uniqueKey("order-idempotency");
    const order = await unitOfWork.run((context) =>
      context.orders.append({
        accountId: account.id,
        positionId: null,
        code: "600519",
        side: PaperOrderSide.buy,
        quantity: 100,
        priceFen: null,
        status: PaperOrderStatus.pending_confirmation,
        riskSnapshotJson: "{}",
        settingsVersion: 1,
        idempotencyKey,
        confirmedAt: null,
        completedAt: null,
      }),
    );
    await expect(
      unitOfWork.run((context) => context.orders.findByIdempotencyKey(idempotencyKey)),
    ).resolves.toMatchObject({ id: order.id, priceFen: null });
    await expect(
      unitOfWork.run((context) => context.orders.findById(order.id)),
    ).resolves.toMatchObject({ id: order.id, priceFen: null });
    await expect(
      unitOfWork.run((context) => context.orders.listByAccount(account.id)),
    ).resolves.toMatchObject([{ id: order.id }]);
    await expect(
      unitOfWork.run((context) =>
        context.orders.append({
          accountId: account.id,
          positionId: null,
          code: "000001",
          side: PaperOrderSide.buy,
          quantity: 100,
          priceFen: null,
          status: PaperOrderStatus.pending_confirmation,
          riskSnapshotJson: "{}",
          settingsVersion: 1,
          idempotencyKey,
          confirmedAt: null,
          completedAt: null,
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
    await unitOfWork.run(async (context) => {
      await context.fills.append({
        orderId: order.id,
        sequence: 2,
        quantity: 50,
        priceFen: BigInt("150000"),
        notionalFen: BigInt("7500000"),
        commissionFen: BigInt("500"),
        stampDutyFen: BigInt("0"),
        transferFeeFen: BigInt("75"),
        tradingDate: "2026-08-04",
        executedAt: iso(2),
      });
      await context.fills.append({
        orderId: order.id,
        sequence: 1,
        quantity: 50,
        priceFen: BigInt("150000"),
        notionalFen: BigInt("7500000"),
        commissionFen: BigInt("500"),
        stampDutyFen: BigInt("0"),
        transferFeeFen: BigInt("75"),
        tradingDate: "2026-08-04",
        executedAt: iso(1),
      });
      expect("update" in context.fills).toBe(false);
      expect("delete" in context.fills).toBe(false);
      expect("update" in context.ledger).toBe(false);
      expect("delete" in context.ledger).toBe(false);
      expect("update" in context.audit).toBe(false);
      expect("delete" in context.audit).toBe(false);
    });
    const [byOrder, byAccount] = await unitOfWork.run((context) =>
      Promise.all([context.fills.listByOrder(order.id), context.fills.listByAccount(account.id)]),
    );
    expect(byOrder.map((fill) => fill.sequence)).toEqual([1, 2]);
    expect(byAccount).toHaveLength(2);
    expect(typeof byAccount[0]?.notionalFen).toBe("bigint");
    await expect(
      unitOfWork.run((context) => context.fills.findByOrderAndSequence(order.id, 1)),
    ).resolves.toMatchObject({ sequence: 1 });
  });

  it("appends and supersedes exit rules with versioned conflicts", async () => {
    const account = await createAccount();
    const settings = await createSettings(account.id);
    const position = await createPosition(account.id);
    const idempotencyKey = uniqueKey("exit-rule");
    const rule = await unitOfWork.run((context) =>
      context.exitRules.append({
        positionId: position.id,
        version: 1,
        settingsVersion: settings.version,
        firstTargetPriceFen: BigInt("160000"),
        secondTargetPriceFen: BigInt("180000"),
        stopPriceFen: BigInt("140000"),
        actorId: "test",
        idempotencyKey,
        confirmedAt: iso(),
      }),
    );
    expect(rule.isActive).toBe(true);
    expect(rule.firstTargetExecutedAt).toBeNull();
    await expect(
      unitOfWork.run((context) => context.exitRules.findActiveByPosition(position.id)),
    ).resolves.toMatchObject({ id: rule.id });
    await expect(
      unitOfWork.run((context) => context.exitRules.listByPosition(position.id)),
    ).resolves.toMatchObject([{ id: rule.id }]);
    const supersededAt = iso(1);
    const superseded = await unitOfWork.run((context) =>
      context.exitRules.supersede({ ruleId: rule.id, expectedVersion: 1, supersededAt }),
    );
    expect(superseded.isActive).toBe(false);
    expect(superseded.supersededAt).toBe(supersededAt);
    expect(superseded.version).toBe(1);
    await expect(
      unitOfWork.run((context) =>
        context.exitRules.supersede({ ruleId: rule.id, expectedVersion: 1, supersededAt: iso(2) }),
      ),
    ).rejects.toThrow("EXIT_RULE_VERSION_CONFLICT");
    await expect(
      unitOfWork.run((context) =>
        context.exitRules.append({
          positionId: position.id,
          version: 2,
          settingsVersion: settings.version,
          firstTargetPriceFen: BigInt("160000"),
          secondTargetPriceFen: BigInt("180000"),
          stopPriceFen: BigInt("140000"),
          actorId: "test",
          idempotencyKey,
          confirmedAt: iso(),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
  });

  it("creates and version-updates worker state without a Prisma upsert", async () => {
    const account = await createAccount();
    const created = await unitOfWork.run((context) =>
      context.workerStates.upsertWithVersion({
        accountId: account.id,
        code: "600519",
        status: PaperWorkerStatus.idle,
        lastProcessedMinuteAt: null,
        lastSuccessfulCheckAt: null,
        lastErrorCode: null,
        expectedVersion: null,
      }),
    );
    expect(created.version).toBe(1);
    await expect(
      unitOfWork.run((context) => context.workerStates.findByAccountAndCode(account.id, "600519")),
    ).resolves.toMatchObject({ id: created.id });
    await expect(
      unitOfWork.run((context) => context.workerStates.listByAccount(account.id)),
    ).resolves.toMatchObject([{ id: created.id }]);
    await expect(
      unitOfWork.run((context) =>
        context.workerStates.upsertWithVersion({
          accountId: account.id,
          code: "600519",
          status: PaperWorkerStatus.idle,
          lastProcessedMinuteAt: null,
          lastSuccessfulCheckAt: null,
          lastErrorCode: null,
          expectedVersion: null,
        }),
      ),
    ).rejects.toThrow("WORKER_STATE_VERSION_CONFLICT");
    const updatedAt = iso();
    const updated = await unitOfWork.run((context) =>
      context.workerStates.upsertWithVersion({
        accountId: account.id,
        code: "600519",
        status: PaperWorkerStatus.running,
        lastProcessedMinuteAt: updatedAt,
        lastSuccessfulCheckAt: updatedAt,
        lastErrorCode: null,
        expectedVersion: 1,
      }),
    );
    expect(updated.version).toBe(2);
    expect(updated.lastProcessedMinuteAt).toBe(updatedAt);
    await expect(
      unitOfWork.run((context) =>
        context.workerStates.upsertWithVersion({
          accountId: account.id,
          code: "600519",
          status: PaperWorkerStatus.paused,
          lastProcessedMinuteAt: null,
          lastSuccessfulCheckAt: null,
          lastErrorCode: null,
          expectedVersion: 1,
        }),
      ),
    ).rejects.toThrow("WORKER_STATE_VERSION_CONFLICT");
  });

  it("acquires, heartbeats, and releases worker leases with compare-and-swap", async () => {
    const leaseKey = uniqueKey("lease");
    const acquiredAt = iso();
    const lease = await unitOfWork.run((context) =>
      context.leases.acquire({
        leaseKey,
        ownerId: "worker-a",
        acquiredAt,
        heartbeatAt: acquiredAt,
        expiresAt: iso(45),
      }),
    );
    expect(lease.version).toBe(1);
    expect(lease.acquiredAt).toBe(acquiredAt);
    await expect(
      unitOfWork.run((context) =>
        context.leases.acquire({
          leaseKey,
          ownerId: "worker-b",
          acquiredAt,
          heartbeatAt: acquiredAt,
          expiresAt: iso(45),
        }),
      ),
    ).rejects.toThrow("WORKER_LEASE_VERSION_CONFLICT");
    const heartbeatAt = iso(10);
    const heartbeated = await unitOfWork.run((context) =>
      context.leases.heartbeat({
        leaseKey,
        ownerId: "worker-a",
        expectedVersion: 1,
        heartbeatAt,
        expiresAt: iso(55),
      }),
    );
    expect(heartbeated.version).toBe(2);
    expect(heartbeated.heartbeatAt).toBe(heartbeatAt);
    await expect(
      unitOfWork.run((context) =>
        context.leases.heartbeat({
          leaseKey,
          ownerId: "worker-b",
          expectedVersion: 1,
          heartbeatAt,
          expiresAt: iso(55),
        }),
      ),
    ).rejects.toThrow("WORKER_LEASE_VERSION_CONFLICT");
    const releasedAt = iso(20);
    const released = await unitOfWork.run((context) =>
      context.leases.release({
        leaseKey,
        ownerId: "worker-a",
        expectedVersion: 2,
        releasedAt,
      }),
    );
    expect(released.version).toBe(3);
    expect(released.heartbeatAt).toBe(releasedAt);
    expect(released.expiresAt).toBe(releasedAt);
    await expect(prisma.workerLease.findUnique({ where: { leaseKey } })).resolves.not.toBeNull();
  });

  it("rejects non-canonical ISO date-time values", async () => {
    const account = await createAccount();
    for (const invalidDateTime of [
      "not-a-date",
      "2026-08-04",
      "2026-08-04T01:00:00Z",
      "2026-08-04T09:00:00.000+08:00",
      "+010000-01-01T00:00:00.000Z",
    ]) {
      await expect(
        unitOfWork.run((context) =>
          context.settings.append({
            scopeKey: uniqueKey("invalid-settings-scope"),
            accountId: account.id,
            version: 1,
            initialCashForNewAccountsFen: null,
            commissionRatePpm: 250,
            minimumCommissionFen: BigInt("500"),
            stampDutySellRatePpm: 500,
            transferFeeRatePpm: 10,
            maxSingleStockBp: 3000,
            maxTotalPositionBp: 8000,
            maxRiskBp: 200,
            actorId: "test",
            occurredAt: invalidDateTime,
            idempotencyKey: uniqueKey("invalid-settings-key"),
          }),
        ),
      ).rejects.toThrow("PAPER_ACCOUNT_DATE_INVALID");
      await expect(
        unitOfWork.run((context) =>
          context.leases.acquire({
            leaseKey: uniqueKey("invalid-lease"),
            ownerId: "worker-a",
            acquiredAt: invalidDateTime,
            heartbeatAt: iso(),
            expiresAt: iso(45),
          }),
        ),
      ).rejects.toThrow("PAPER_ACCOUNT_DATE_INVALID");
    }
  });
});
