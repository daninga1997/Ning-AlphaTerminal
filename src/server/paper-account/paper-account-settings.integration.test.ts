import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPaperAccountSettingsService } from "./paper-account-settings-service";
import { createPaperAccountCashAdjustmentService } from "./paper-account-cash-adjustment-service";
import { createPrismaPaperAccountUnitOfWork } from "./prisma-paper-account-unit-of-work";

const prisma = new PrismaClient();
const unitOfWork = createPrismaPaperAccountUnitOfWork(prisma);
const settingsService = createPaperAccountSettingsService(unitOfWork);
const cashAdjustmentService = createPaperAccountCashAdjustmentService(unitOfWork);

let sequence = 0;

function uniqueKey(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

const occurredAt = "2026-08-04T02:00:00.000Z";

let uniqueSequence = 0;
const task8SettingsActorPrefix = `task8-settings-${Date.now()}`;

function task8SettingsActor(label: string): string {
  uniqueSequence += 1;
  return `${task8SettingsActorPrefix}:${label}:${uniqueSequence}`;
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createFixtureAccount(): Promise<{ accountId: string; accountKey: string }> {
  const accountKey = uniqueKey("fixture");
  let accountId = "";

  await unitOfWork.run(async (context) => {
    const account = await context.accounts.create({
      accountKey,
      initialCashFen: BigInt("10000000"),
      status: "active",
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
      actorId: task8SettingsActor("fixture-init"),
      occurredAt,
      idempotencyKey: uniqueKey("init-settings"),
    });
    accountId = account.id;
  });

  return { accountId, accountKey };
}

describe.sequential("PaperAccountSettings integration", () => {
  // 1 ── Account settings append-only versioning ─────────────────────────

  it("appends new account settings version without overwriting history", async () => {
    const { accountId } = await createFixtureAccount();

    const result = await settingsService.createAccountSettingsVersion({
      accountId,
      commissionRatePpm: 300,
      minimumCommissionFen: BigInt("600"),
      stampDutySellRatePpm: 550,
      transferFeeRatePpm: 12,
      maxSingleStockBp: 2500,
      maxTotalPositionBp: 7000,
      maxRiskBp: 150,
      actorId: "integration-test",
      occurredAt,
      idempotencyKey: uniqueKey("v2"),
    });

    expect(result.version).toBe(2);

    // Both versions exist
    const allVersions = await prisma.paperAccountSettingsVersion.findMany({
      where: { scopeKey: `account:${accountId}` },
      orderBy: { version: "asc" },
    });
    expect(allVersions.length).toBe(2);
    expect(allVersions[0].version).toBe(1);
    expect(allVersions[1].version).toBe(2);
    expect(allVersions[1].commissionRatePpm).toBe(300);

    // Account cash unchanged
    const account = await prisma.paperAccount.findUnique({ where: { id: accountId } });
    expect(account!.initialCashFen).toBe(BigInt("10000000"));
    expect(account!.availableCashFen).toBe(BigInt("10000000"));

    // No extra ledger or audit entries
    const ledgerCount = await prisma.cashLedgerEntry.count({ where: { accountId } });
    const auditCount = await prisma.paperAuditLog.count({ where: { accountId } });
    expect(ledgerCount).toBe(0);
    expect(auditCount).toBe(0);
  });

  // 2 ── Idempotent repeat ───────────────────────────────────────────────

  it("returns same record on idempotent repeat", async () => {
    const { accountId } = await createFixtureAccount();
    const idempotencyKey = uniqueKey("dup-v2");

    const r1 = await settingsService.createAccountSettingsVersion({
      accountId,
      commissionRatePpm: 350,
      minimumCommissionFen: BigInt("700"),
      stampDutySellRatePpm: 600,
      transferFeeRatePpm: 15,
      maxSingleStockBp: 3000,
      maxTotalPositionBp: 8000,
      maxRiskBp: 200,
      actorId: "integration-test",
      occurredAt,
      idempotencyKey,
    });

    // Repeat with different values
    const r2 = await settingsService.createAccountSettingsVersion({
      accountId,
      commissionRatePpm: 999,
      minimumCommissionFen: BigInt("999"),
      stampDutySellRatePpm: 999,
      transferFeeRatePpm: 99,
      maxSingleStockBp: 999,
      maxTotalPositionBp: 999,
      maxRiskBp: 999,
      actorId: "integration-test",
      occurredAt,
      idempotencyKey,
    });

    expect(r2.id).toBe(r1.id);
    expect(r2.version).toBe(2);
    expect(r2.commissionRatePpm).toBe(350); // original value preserved

    // No version 3 created
    const allVersions = await prisma.paperAccountSettingsVersion.findMany({
      where: { scopeKey: `account:${accountId}` },
    });
    expect(allVersions.length).toBe(2);
  });

  // 3 ── INITIAL_CASH_IMMUTABLE ──────────────────────────────────────────

  it("rejects explicit initialCashForNewAccountsFen", async () => {
    const { accountId } = await createFixtureAccount();

    const input = {
      accountId,
      commissionRatePpm: 300,
      minimumCommissionFen: BigInt("600"),
      stampDutySellRatePpm: 550,
      transferFeeRatePpm: 12,
      maxSingleStockBp: 2500,
      maxTotalPositionBp: 7000,
      maxRiskBp: 150,
      actorId: "integration-test",
      occurredAt,
      idempotencyKey: uniqueKey("immutable"),
      initialCashForNewAccountsFen: BigInt("20000000"),
    };

    await expect(
      settingsService.createAccountSettingsVersion(input as unknown as Parameters<typeof settingsService.createAccountSettingsVersion>[0]),
    ).rejects.toThrow("INITIAL_CASH_IMMUTABLE");

    // No new version, account cash unchanged
    const allVersions = await prisma.paperAccountSettingsVersion.findMany({
      where: { scopeKey: `account:${accountId}` },
    });
    expect(allVersions.length).toBe(1);

    const account = await prisma.paperAccount.findUnique({ where: { id: accountId } });
    expect(account!.initialCashFen).toBe(BigInt("10000000"));
  });

  // 4 ── Credit adjustment ───────────────────────────────────────────────

  it("completes credit adjustment and idempotent repeat", async () => {
    const { accountId } = await createFixtureAccount();
    const idempotencyKey = uniqueKey("credit-adj");

    const result = await cashAdjustmentService.adjustPaperAccountCash({
      accountId,
      direction: "credit",
      amountFen: BigInt("1000000"),
      reason: "test credit",
      actorId: "integration-test",
      occurredAt,
      idempotencyKey,
      expectedAccountVersion: 1,
    });

    expect(result.created).toBe(true);
    expect(result.availableCashFen).toBe(BigInt("11000000"));
    expect(result.accountVersion).toBe(2);
    expect(typeof result.ledgerEntryId).toBe("string");

    // Verify DB
    const account = await prisma.paperAccount.findUnique({ where: { id: accountId } });
    expect(account!.availableCashFen).toBe(BigInt("11000000"));
    expect(account!.accountVersion).toBe(2);

    const ledgerEntries = await prisma.cashLedgerEntry.findMany({ where: { accountId } });
    expect(ledgerEntries.length).toBe(1);
    expect(ledgerEntries[0].direction).toBe("credit");
    expect(ledgerEntries[0].type).toBe("cash_adjustment");
    expect(ledgerEntries[0].amountFen).toBe(BigInt("1000000"));
    expect(ledgerEntries[0].balanceAfterFen).toBe(BigInt("11000000"));

    const auditEntries = await prisma.paperAuditLog.findMany({ where: { accountId } });
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].action).toBe("cash_adjusted");

    // Idempotent repeat with old version
    const r2 = await cashAdjustmentService.adjustPaperAccountCash({
      accountId,
      direction: "credit",
      amountFen: BigInt("1000000"),
      reason: "test credit",
      actorId: "integration-test",
      occurredAt,
      idempotencyKey,
      expectedAccountVersion: 1, // old version
    });

    expect(r2.created).toBe(false);
    expect(r2.availableCashFen).toBe(BigInt("11000000"));
    expect(r2.accountVersion).toBe(2);

    // No extra entries
    expect(await prisma.cashLedgerEntry.count({ where: { accountId } })).toBe(1);
    expect(await prisma.paperAuditLog.count({ where: { accountId } })).toBe(1);
  });

  // 5 ── Debit adjustment ────────────────────────────────────────────────

  it("completes debit adjustment and ledger consistency", async () => {
    const { accountId } = await createFixtureAccount();

    // Credit first
    await cashAdjustmentService.adjustPaperAccountCash({
      accountId,
      direction: "credit",
      amountFen: BigInt("1000000"),
      reason: "setup credit",
      actorId: "integration-test",
      occurredAt,
      idempotencyKey: uniqueKey("setup-credit"),
      expectedAccountVersion: 1,
    });

    // Then debit
    const result = await cashAdjustmentService.adjustPaperAccountCash({
      accountId,
      direction: "debit",
      amountFen: BigInt("500000"),
      reason: "test debit",
      actorId: "integration-test",
      occurredAt,
      idempotencyKey: uniqueKey("test-debit"),
      expectedAccountVersion: 2,
    });

    expect(result.availableCashFen).toBe(BigInt("10500000"));

    // Ledger consistency: availableCash = initial + credits - debits
    const account = await prisma.paperAccount.findUnique({ where: { id: accountId } });
    const entries = await prisma.cashLedgerEntry.findMany({ where: { accountId } });
    const credits = entries.filter((e) => e.direction === "credit" && e.type === "cash_adjustment")
      .reduce((sum, e) => sum + e.amountFen, BigInt("0"));
    const debits = entries.filter((e) => e.direction === "debit" && e.type === "cash_adjustment")
      .reduce((sum, e) => sum + e.amountFen, BigInt("0"));

    expect(account!.initialCashFen + credits - debits).toBe(account!.availableCashFen);
  });

  // 6 ── Insufficient cash and version conflict produce no writes ────────

  it("rejects insufficient cash without any writes", async () => {
    const { accountId } = await createFixtureAccount();

    const ledgerBefore = await prisma.cashLedgerEntry.count({ where: { accountId } });
    const auditBefore = await prisma.paperAuditLog.count({ where: { accountId } });

    await expect(
      cashAdjustmentService.adjustPaperAccountCash({
        accountId,
        direction: "debit",
        amountFen: BigInt("20000000"),
        reason: "overshoot",
        actorId: "integration-test",
        occurredAt,
        idempotencyKey: uniqueKey("overshoot"),
        expectedAccountVersion: 1,
      }),
    ).rejects.toThrow("PAPER_ACCOUNT_INSUFFICIENT_CASH");

    expect(await prisma.cashLedgerEntry.count({ where: { accountId } })).toBe(ledgerBefore);
    expect(await prisma.paperAuditLog.count({ where: { accountId } })).toBe(auditBefore);

    const account = await prisma.paperAccount.findUnique({ where: { id: accountId } });
    expect(account!.availableCashFen).toBe(BigInt("10000000"));
    expect(account!.accountVersion).toBe(1);
  });

  it("rejects version conflict without any writes", async () => {
    const { accountId } = await createFixtureAccount();

    const ledgerBefore = await prisma.cashLedgerEntry.count({ where: { accountId } });

    await expect(
      cashAdjustmentService.adjustPaperAccountCash({
        accountId,
        direction: "credit",
        amountFen: BigInt("500000"),
        reason: "version conflict test",
        actorId: "integration-test",
        occurredAt,
        idempotencyKey: uniqueKey("version-conflict"),
        expectedAccountVersion: 99,
      }),
    ).rejects.toThrow("ACCOUNT_VERSION_CONFLICT");

    expect(await prisma.cashLedgerEntry.count({ where: { accountId } })).toBe(ledgerBefore);
  });

  // 7 ── Audit conflict rolls back entire transaction ────────────────────

  it("rolls back account update and ledger on audit conflict", async () => {
    const { accountId: fixtureId } = await createFixtureAccount();
    const { accountId: targetId } = await createFixtureAccount();
    const idempotencyKey = uniqueKey("rollback-adj");

    // Pre-create a conflicting audit on fixture account
    await unitOfWork.run(async (context) => {
      await context.audit.append({
        accountId: fixtureId,
        sequence: 1,
        action: "cash_adjusted",
        actorId: "integration-test",
        entityType: "CashLedgerEntry",
        entityId: "some-ledger",
        payloadJson: "{}",
        idempotencyKey: `${idempotencyKey}:audit`,
        occurredAt,
      });
    });

    // Record pre-state
    const targetBefore = await prisma.paperAccount.findUnique({ where: { id: targetId } });
    const ledgerBefore = await prisma.cashLedgerEntry.count({ where: { accountId: targetId } });
    const auditBefore = await prisma.paperAuditLog.count({ where: { accountId: targetId } });

    await expect(
      cashAdjustmentService.adjustPaperAccountCash({
        accountId: targetId,
        direction: "credit",
        amountFen: BigInt("500000"),
        reason: "rollback test",
        actorId: "integration-test",
        occurredAt,
        idempotencyKey,
        expectedAccountVersion: targetBefore!.accountVersion,
      }),
    ).rejects.toThrow();

    // Verify full rollback
    const targetAfter = await prisma.paperAccount.findUnique({ where: { id: targetId } });
    expect(targetAfter!.availableCashFen).toBe(targetBefore!.availableCashFen);
    expect(targetAfter!.accountVersion).toBe(targetBefore!.accountVersion);
    expect(await prisma.cashLedgerEntry.count({ where: { accountId: targetId } })).toBe(ledgerBefore);
    expect(await prisma.paperAuditLog.count({ where: { accountId: targetId } })).toBe(auditBefore);
  });

  // 8 ── Idempotent rejection with different input ───────────────────────

  it("rejects idempotent repeat with different amount", async () => {
    const { accountId } = await createFixtureAccount();
    const idempotencyKey = uniqueKey("mismatch-adj");

    await cashAdjustmentService.adjustPaperAccountCash({
      accountId,
      direction: "credit",
      amountFen: BigInt("1000000"),
      reason: "original",
      actorId: "integration-test",
      occurredAt,
      idempotencyKey,
      expectedAccountVersion: 1,
    });

    // Repeat with different amount
    await expect(
      cashAdjustmentService.adjustPaperAccountCash({
        accountId,
        direction: "credit",
        amountFen: BigInt("2000000"),
        reason: "original",
        actorId: "integration-test",
        occurredAt,
        idempotencyKey,
        expectedAccountVersion: 2,
      }),
    ).rejects.toThrow("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
  });

  // 9 ── Ownership protection: Task 8 does not create business default scope ─

  it("does not create new-account-default settings", async () => {
    const task8OwnedSettings =
      await prisma.paperAccountSettingsVersion.findMany({
        where: {
          actorId: {
            startsWith: task8SettingsActorPrefix,
          },
        },
        select: {
          id: true,
          scopeKey: true,
          accountId: true,
          actorId: true,
          version: true,
        },
        orderBy: [
          { scopeKey: "asc" },
          { version: "asc" },
        ],
      });

    expect(task8OwnedSettings.length).toBeGreaterThan(0);

    expect(
      task8OwnedSettings.every((s) => s.accountId !== null),
    ).toBe(true);

    expect(
      task8OwnedSettings.every(
        (s) => s.scopeKey === `account:${s.accountId}`,
      ),
    ).toBe(true);

    expect(
      task8OwnedSettings.filter(
        (s) => s.scopeKey === "new-account-default",
      ),
    ).toHaveLength(0);
  });
});