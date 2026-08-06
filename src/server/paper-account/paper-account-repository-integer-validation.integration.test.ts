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
import { createPrismaPaperAccountUnitOfWork } from "./prisma-paper-account-unit-of-work";

const prisma = new PrismaClient();
const unitOfWork = createPrismaPaperAccountUnitOfWork(prisma);

let sequence = 0;

function uniqueKey(prefix: string): string {
  sequence += 1;
  return `review3-${prefix}-${sequence}`;
}

function iso(offsetSeconds = 0): string {
  return new Date(
    Date.UTC(2026, 7, 4, 0, 0, offsetSeconds),
  ).toISOString();
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createAccount(): Promise<string> {
  const account = await unitOfWork.run((context) =>
    context.accounts.create({
      accountKey: uniqueKey("account"),
      initialCashFen: BigInt("10000000"),
      status: PaperAccountStatus.active,
    }),
  );
  return account.id;
}

async function createPosition(accountId: string): Promise<string> {
  const position = await unitOfWork.run((context) =>
    context.positions.create({
      accountId,
      code: uniqueKey("code").slice(-6),
      totalQuantity: 100,
      sellableQuantity: 100,
      frozenQuantity: 0,
      averageCostFen: BigInt("150000"),
      realizedPnlFen: BigInt("0"),
    }),
  );
  return position.id;
}

async function createOrder(accountId: string, positionId: string | null = null): Promise<string> {
  const order = await unitOfWork.run((context) =>
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
  return order.id;
}

async function createExitRule(positionId: string): Promise<string> {
  const settings = await unitOfWork.run((context) =>
    context.settings.append({
      scopeKey: uniqueKey("settings-scope"),
      accountId: null,
      version: 1,
      initialCashForNewAccountsFen: BigInt("10000000"),
      commissionRatePpm: 250,
      minimumCommissionFen: BigInt("500"),
      stampDutySellRatePpm: 500,
      transferFeeRatePpm: 10,
      maxSingleStockBp: 3000,
      maxTotalPositionBp: 8000,
      maxRiskBp: 200,
      actorId: "review3-test",
      occurredAt: iso(),
      idempotencyKey: uniqueKey("settings"),
    }),
  );
  const rule = await unitOfWork.run((context) =>
    context.exitRules.append({
      positionId,
      version: 1,
      settingsVersion: settings.version,
      firstTargetPriceFen: BigInt("160000"),
      secondTargetPriceFen: BigInt("180000"),
      stopPriceFen: BigInt("140000"),
      actorId: "review3-test",
      idempotencyKey: uniqueKey("exit-rule"),
      confirmedAt: iso(),
    }),
  );
  return rule.id;
}

async function createWorkerState(accountId: string, code: string): Promise<string> {
  const state = await unitOfWork.run((context) =>
    context.workerStates.upsertWithVersion({
      accountId,
      code,
      status: PaperWorkerStatus.idle,
      lastProcessedMinuteAt: null,
      lastSuccessfulCheckAt: null,
      lastErrorCode: null,
      expectedVersion: null,
    }),
  );
  return state.id;
}

async function acquireLease(leaseKey: string): Promise<number> {
  const lease = await unitOfWork.run((context) =>
    context.leases.acquire({
      leaseKey,
      ownerId: "worker-a",
      acquiredAt: iso(0),
      heartbeatAt: iso(0),
      expiresAt: iso(45),
    }),
  );
  return lease.version;
}

describe.sequential("paper account repository integer validation", () => {
  // ── Negative values for non-negative fields ─────────────────────────

  it("rejects negative commissionRatePpm on settings.append", async () => {
    const accountId = await createAccount();
    await expect(
      unitOfWork.run((context) =>
        context.settings.append({
          scopeKey: `account:${accountId}`,
          accountId,
          version: 1,
          initialCashForNewAccountsFen: null,
          commissionRatePpm: -1,
          minimumCommissionFen: BigInt("500"),
          stampDutySellRatePpm: 500,
          transferFeeRatePpm: 10,
          maxSingleStockBp: 3000,
          maxTotalPositionBp: 8000,
          maxRiskBp: 200,
          actorId: "review3-test",
          occurredAt: iso(),
          idempotencyKey: uniqueKey("settings-neg-ppm"),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects negative maxSingleStockBp on settings.append", async () => {
    const accountId = await createAccount();
    await expect(
      unitOfWork.run((context) =>
        context.settings.append({
          scopeKey: `account:${accountId}`,
          accountId,
          version: 1,
          initialCashForNewAccountsFen: null,
          commissionRatePpm: 250,
          minimumCommissionFen: BigInt("500"),
          stampDutySellRatePpm: 500,
          transferFeeRatePpm: 10,
          maxSingleStockBp: -1,
          maxTotalPositionBp: 8000,
          maxRiskBp: 200,
          actorId: "review3-test",
          occurredAt: iso(),
          idempotencyKey: uniqueKey("settings-neg-bp"),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects negative totalQuantity on positions.create", async () => {
    const accountId = await createAccount();
    await expect(
      unitOfWork.run((context) =>
        context.positions.create({
          accountId,
          code: uniqueKey("negpos").slice(-6),
          totalQuantity: -1,
          sellableQuantity: 0,
          frozenQuantity: 0,
          averageCostFen: BigInt("1000"),
          realizedPnlFen: BigInt("0"),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");

    const remaining = await unitOfWork.run((context) => context.positions.listByAccount(accountId));
    expect(remaining).toHaveLength(0);
  });

  it("rejects negative remainingQuantity on lots.append", async () => {
    const accountId = await createAccount();
    const positionId = await createPosition(accountId);
    await expect(
      unitOfWork.run((context) =>
        context.lots.append({
          positionId,
          acquiredSequence: 1,
          acquiredTradingDate: "2026-08-04",
          sellableTradingDate: "2026-08-05",
          originalQuantity: 100,
          remainingQuantity: -1,
          priceFen: BigInt("150000"),
          buyFeeFen: BigInt("500"),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects negative quantity on orders.append", async () => {
    const accountId = await createAccount();
    await expect(
      unitOfWork.run((context) =>
        context.orders.append({
          accountId,
          positionId: null,
          code: "600519",
          side: PaperOrderSide.buy,
          quantity: -1,
          priceFen: null,
          status: PaperOrderStatus.pending_confirmation,
          riskSnapshotJson: "{}",
          settingsVersion: 1,
          idempotencyKey: uniqueKey("order-neg-qty"),
          confirmedAt: null,
          completedAt: null,
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects negative quantity on fills.append", async () => {
    const accountId = await createAccount();
    const orderId = await createOrder(accountId);
    await expect(
      unitOfWork.run((context) =>
        context.fills.append({
          orderId,
          sequence: 1,
          quantity: -1,
          priceFen: BigInt("150000"),
          notionalFen: BigInt("7500000"),
          commissionFen: BigInt("500"),
          stampDutyFen: BigInt("0"),
          transferFeeFen: BigInt("75"),
          tradingDate: "2026-08-04",
          executedAt: iso(),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  // ── Zero sequence values ─────────────────────────────────────────────

  it("rejects zero acquiredSequence on lots.append", async () => {
    const accountId = await createAccount();
    const positionId = await createPosition(accountId);
    await expect(
      unitOfWork.run((context) =>
        context.lots.append({
          positionId,
          acquiredSequence: 0,
          acquiredTradingDate: "2026-08-04",
          sellableTradingDate: "2026-08-05",
          originalQuantity: 100,
          remainingQuantity: 100,
          priceFen: BigInt("150000"),
          buyFeeFen: BigInt("500"),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects zero sequence on fills.findByOrderAndSequence", async () => {
    const accountId = await createAccount();
    const orderId = await createOrder(accountId);
    await expect(
      unitOfWork.run((context) => context.fills.findByOrderAndSequence(orderId, 0)),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects zero sequence on fills.append", async () => {
    const accountId = await createAccount();
    const orderId = await createOrder(accountId);
    await expect(
      unitOfWork.run((context) =>
        context.fills.append({
          orderId,
          sequence: 0,
          quantity: 100,
          priceFen: BigInt("150000"),
          notionalFen: BigInt("7500000"),
          commissionFen: BigInt("500"),
          stampDutyFen: BigInt("0"),
          transferFeeFen: BigInt("75"),
          tradingDate: "2026-08-04",
          executedAt: iso(),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects zero sequence on ledger.append", async () => {
    const accountId = await createAccount();
    await expect(
      unitOfWork.run((context) =>
        context.ledger.append({
          accountId,
          orderId: null,
          sequence: 0,
          direction: CashLedgerDirection.credit,
          type: CashLedgerType.initial_cash,
          amountFen: BigInt("10000000"),
          balanceAfterFen: BigInt("10000000"),
          idempotencyKey: uniqueKey("ledger-zero-seq"),
          metadataJson: "{}",
          occurredAt: iso(),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects zero sequence on audit.append", async () => {
    const accountId = await createAccount();
    await expect(
      unitOfWork.run((context) =>
        context.audit.append({
          accountId,
          sequence: 0,
          action: "test",
          actorId: "review3-test",
          entityType: "PaperAccount",
          entityId: accountId,
          payloadJson: "{}",
          idempotencyKey: uniqueKey("audit-zero-seq"),
          occurredAt: iso(),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  // ── Zero version values ──────────────────────────────────────────────

  it("rejects zero expectedAccountVersion on accounts.updateCash", async () => {
    const accountId = await createAccount();
    await expect(
      unitOfWork.run((context) =>
        context.accounts.updateCash({
          accountId,
          availableCashFen: BigInt("9000000"),
          frozenCashFen: BigInt("1000000"),
          expectedAccountVersion: 0,
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects zero version on settings.append", async () => {
    const accountId = await createAccount();
    await expect(
      unitOfWork.run((context) =>
        context.settings.append({
          scopeKey: `account:${accountId}`,
          accountId,
          version: 0,
          initialCashForNewAccountsFen: null,
          commissionRatePpm: 250,
          minimumCommissionFen: BigInt("500"),
          stampDutySellRatePpm: 500,
          transferFeeRatePpm: 10,
          maxSingleStockBp: 3000,
          maxTotalPositionBp: 8000,
          maxRiskBp: 200,
          actorId: "review3-test",
          occurredAt: iso(),
          idempotencyKey: uniqueKey("settings-zero-version"),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects zero expectedVersion on positions.updateWithVersion", async () => {
    const accountId = await createAccount();
    const positionId = await createPosition(accountId);
    await expect(
      unitOfWork.run((context) =>
        context.positions.updateWithVersion({
          positionId,
          totalQuantity: 100,
          sellableQuantity: 100,
          frozenQuantity: 0,
          averageCostFen: BigInt("150000"),
          realizedPnlFen: BigInt("0"),
          expectedVersion: 0,
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects zero settingsVersion on orders.append", async () => {
    const accountId = await createAccount();
    await expect(
      unitOfWork.run((context) =>
        context.orders.append({
          accountId,
          positionId: null,
          code: "600519",
          side: PaperOrderSide.buy,
          quantity: 100,
          priceFen: null,
          status: PaperOrderStatus.pending_confirmation,
          riskSnapshotJson: "{}",
          settingsVersion: 0,
          idempotencyKey: uniqueKey("order-zero-settings"),
          confirmedAt: null,
          completedAt: null,
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects zero expectedVersion on orders.updateStatusWithVersion", async () => {
    const accountId = await createAccount();
    const orderId = await createOrder(accountId);
    await expect(
      unitOfWork.run((context) =>
        context.orders.updateStatusWithVersion({
          orderId,
          fromStatus: PaperOrderStatus.pending_confirmation,
          toStatus: PaperOrderStatus.confirmed,
          expectedVersion: 0,
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects zero version on exitRules.append", async () => {
    const accountId = await createAccount();
    const positionId = await createPosition(accountId);
    const settingsId = await unitOfWork.run((context) =>
      context.settings.append({
        scopeKey: uniqueKey("settings-scope"),
        accountId: null,
        version: 1,
        initialCashForNewAccountsFen: BigInt("10000000"),
        commissionRatePpm: 250,
        minimumCommissionFen: BigInt("500"),
        stampDutySellRatePpm: 500,
        transferFeeRatePpm: 10,
        maxSingleStockBp: 3000,
        maxTotalPositionBp: 8000,
        maxRiskBp: 200,
        actorId: "review3-test",
        occurredAt: iso(),
        idempotencyKey: uniqueKey("settings"),
      }),
    );

    await expect(
      unitOfWork.run((context) =>
        context.exitRules.append({
          positionId,
          version: 0,
          settingsVersion: settingsId.version,
          firstTargetPriceFen: BigInt("160000"),
          secondTargetPriceFen: BigInt("180000"),
          stopPriceFen: BigInt("140000"),
          actorId: "review3-test",
          idempotencyKey: uniqueKey("exit-rule-zero-version"),
          confirmedAt: iso(),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects zero settingsVersion on exitRules.append", async () => {
    const accountId = await createAccount();
    const positionId = await createPosition(accountId);
    await expect(
      unitOfWork.run((context) =>
        context.exitRules.append({
          positionId,
          version: 1,
          settingsVersion: 0,
          firstTargetPriceFen: BigInt("160000"),
          secondTargetPriceFen: BigInt("180000"),
          stopPriceFen: BigInt("140000"),
          actorId: "review3-test",
          idempotencyKey: uniqueKey("exit-rule-zero-settings"),
          confirmedAt: iso(),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects zero expectedVersion on exitRules.supersede", async () => {
    const accountId = await createAccount();
    const positionId = await createPosition(accountId);
    const ruleId = await createExitRule(positionId);
    await expect(
      unitOfWork.run((context) =>
        context.exitRules.supersede({
          ruleId,
          expectedVersion: 0,
          supersededAt: iso(1),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects zero expectedVersion on workerStates.upsertWithVersion", async () => {
    const accountId = await createAccount();
    const code = uniqueKey("worker-code").slice(-8);
    await createWorkerState(accountId, code);
    await expect(
      unitOfWork.run((context) =>
        context.workerStates.upsertWithVersion({
          accountId,
          code,
          status: PaperWorkerStatus.running,
          lastProcessedMinuteAt: iso(1),
          lastSuccessfulCheckAt: iso(1),
          lastErrorCode: null,
          expectedVersion: 0,
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects zero expectedVersion on workerLease heartbeat", async () => {
    const leaseKey = uniqueKey("lease-hb");
    await acquireLease(leaseKey);
    await expect(
      unitOfWork.run((context) =>
        context.leases.heartbeat({
          leaseKey,
          ownerId: "worker-a",
          expectedVersion: 0,
          heartbeatAt: iso(10),
          expiresAt: iso(55),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  it("rejects zero expectedVersion on workerLease release", async () => {
    const leaseKey = uniqueKey("lease-rel");
    await acquireLease(leaseKey);
    await expect(
      unitOfWork.run((context) =>
        context.leases.release({
          leaseKey,
          ownerId: "worker-a",
          expectedVersion: 0,
          releasedAt: iso(20),
        }),
      ),
    ).rejects.toThrow("PAPER_ACCOUNT_INTEGER_INVALID");
  });

  // ── Zero is legal for non-negative fields ────────────────────────────

  it("allows zero for nonnegative repository integer fields", async () => {
    const accountId = await createAccount();

    const position = await unitOfWork.run((context) =>
      context.positions.create({
        accountId,
        code: uniqueKey("zeropos").slice(-6),
        totalQuantity: 0,
        sellableQuantity: 0,
        frozenQuantity: 0,
        averageCostFen: BigInt("1000"),
        realizedPnlFen: BigInt("0"),
      }),
    );
    expect(position.totalQuantity).toBe(0);
    expect(position.sellableQuantity).toBe(0);
    expect(position.frozenQuantity).toBe(0);

    const settings = await unitOfWork.run((context) =>
      context.settings.append({
        scopeKey: `account:${accountId}`,
        accountId,
        version: 1,
        initialCashForNewAccountsFen: null,
        commissionRatePpm: 0,
        minimumCommissionFen: BigInt("500"),
        stampDutySellRatePpm: 0,
        transferFeeRatePpm: 0,
        maxSingleStockBp: 0,
        maxTotalPositionBp: 0,
        maxRiskBp: 0,
        actorId: "review3-test",
        occurredAt: iso(),
        idempotencyKey: uniqueKey("settings-zero-all"),
      }),
    );
    expect(settings.commissionRatePpm).toBe(0);
    expect(settings.stampDutySellRatePpm).toBe(0);
    expect(settings.transferFeeRatePpm).toBe(0);
    expect(settings.maxSingleStockBp).toBe(0);
    expect(settings.maxTotalPositionBp).toBe(0);
    expect(settings.maxRiskBp).toBe(0);
  });
});