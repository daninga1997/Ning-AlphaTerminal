import { describe, expect, it, vi } from "vitest";
import type { CashLedgerType } from "@prisma/client";
import type {
  PaperAccountTransactionContext,
  PaperAccountUnitOfWork,
} from "./paper-account-unit-of-work";
import type {
  CashLedgerEntryInput,
  CashLedgerEntryRecord,
  PaperAccountRecord,
  PaperAuditLogInput,
  PaperAuditLogRecord,
  UpdatePaperAccountCashInput,
} from "./paper-account-repositories";
import type {
  AdjustPaperAccountCashInput,
  PaperAccountCashAdjustmentDirection,
} from "./paper-account-cash-adjustment-service";
import { createPaperAccountCashAdjustmentService } from "./paper-account-cash-adjustment-service";

// ── Helpers ────────────────────────────────────────────────────────────────

async function unexpectedRepositoryCall(): Promise<never> {
  throw new Error("UNEXPECTED_REPOSITORY_CALL");
}

function createFakeUnitOfWork(
  context: PaperAccountTransactionContext,
  onRun?: () => void,
): PaperAccountUnitOfWork {
  return {
    async run<T>(work: (ctx: PaperAccountTransactionContext) => Promise<T>): Promise<T> {
      onRun?.();
      return work(context);
    },
  };
}

function fullFakeContext(overrides: Partial<PaperAccountTransactionContext> = {}): PaperAccountTransactionContext {
  return {
    accounts: { findById: unexpectedRepositoryCall, findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
    settings: { findLatestByScope: unexpectedRepositoryCall, listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
    positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
    lots: { listByPosition: unexpectedRepositoryCall, listSellableByPosition: unexpectedRepositoryCall, append: unexpectedRepositoryCall, updateRemainingQuantity: unexpectedRepositoryCall },
    orders: { findById: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall, updateStatusWithVersion: unexpectedRepositoryCall },
    fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
    ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: unexpectedRepositoryCall, sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
    exitRules: { findActiveByPosition: unexpectedRepositoryCall, listByPosition: unexpectedRepositoryCall, append: unexpectedRepositoryCall, supersede: unexpectedRepositoryCall },
    audit: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
    workerStates: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: unexpectedRepositoryCall, upsertWithVersion: unexpectedRepositoryCall },
    leases: { findByKey: unexpectedRepositoryCall, acquire: unexpectedRepositoryCall, heartbeat: unexpectedRepositoryCall, release: unexpectedRepositoryCall },
    ...overrides,
  } satisfies PaperAccountTransactionContext;
}

function accountRecord(overrides: Partial<PaperAccountRecord> = {}): PaperAccountRecord {
  return { id: "account-1", accountKey: "paper-1", initialCashFen: BigInt("10000000"), availableCashFen: BigInt("10000000"), frozenCashFen: BigInt("0"), realizedPnlFen: BigInt("0"), cumulativeFeesFen: BigInt("0"), accountVersion: 1, status: "active", createdAt: "2026-08-04T00:00:00.000Z", updatedAt: "2026-08-04T00:00:00.000Z", ...overrides };
}

function ledgerEntry(overrides: Partial<CashLedgerEntryRecord> = {}): CashLedgerEntryRecord {
  return { id: "ledger-1", accountId: "account-1", orderId: null, sequence: 1, direction: "credit", type: "cash_adjustment" as CashLedgerType, amountFen: BigInt("1000000"), balanceAfterFen: BigInt("11000000"), idempotencyKey: "adj-key", metadataJson: JSON.stringify({ reason: "test", actorId: "operator", direction: "credit", amountFen: "1000000", occurredAt: "2026-08-04T02:00:00.000Z", accountVersionBefore: 1, accountVersionAfter: 2, availableCashAfterFen: "11000000" }), occurredAt: "2026-08-04T02:00:00.000Z", createdAt: "2026-08-04T02:00:00.100Z", ...overrides };
}

function auditEntry(overrides: Partial<PaperAuditLogRecord> = {}): PaperAuditLogRecord {
  return { id: "audit-1", accountId: "account-1", sequence: 1, action: "cash_adjusted", actorId: "operator", entityType: "CashLedgerEntry", entityId: "ledger-1", payloadJson: "{}", idempotencyKey: "adj-key:audit", occurredAt: "2026-08-04T02:00:00.000Z", createdAt: "2026-08-04T02:00:00.100Z", ...overrides };
}

function validAdjustment(overrides: Partial<AdjustPaperAccountCashInput> = {}): AdjustPaperAccountCashInput {
  return { accountId: "account-1", direction: "credit" as PaperAccountCashAdjustmentDirection, amountFen: BigInt("1000000"), reason: "bonus", actorId: "operator", occurredAt: "2026-08-04T02:00:00.000Z", idempotencyKey: "adj-key", expectedAccountVersion: 1, ...overrides };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PaperAccountCashAdjustmentService (unit)", () => {
  // 1 ── Basic input validation ───────────────────────────────────────────

  it("rejects blank accountId", async () => {
    const ctx = fullFakeContext(); let runCount = 0;
    const uow = createFakeUnitOfWork(ctx, () => { runCount += 1; });
    const svc = createPaperAccountCashAdjustmentService(uow);
    await expect(svc.adjustPaperAccountCash(validAdjustment({ accountId: "   " }))).rejects.toThrow("PAPER_ACCOUNT_ACCOUNT_ID_REQUIRED");
    expect(runCount).toBe(0);
  });

  it("rejects blank reason", async () => {
    const ctx = fullFakeContext(); let runCount = 0;
    const uow = createFakeUnitOfWork(ctx, () => { runCount += 1; });
    const svc = createPaperAccountCashAdjustmentService(uow);
    await expect(svc.adjustPaperAccountCash(validAdjustment({ reason: "   " }))).rejects.toThrow("PAPER_ACCOUNT_ADJUSTMENT_REASON_REQUIRED");
    expect(runCount).toBe(0);
  });

  it("rejects blank actorId", async () => {
    const ctx = fullFakeContext(); let runCount = 0;
    const uow = createFakeUnitOfWork(ctx, () => { runCount += 1; });
    const svc = createPaperAccountCashAdjustmentService(uow);
    await expect(svc.adjustPaperAccountCash(validAdjustment({ actorId: "   " }))).rejects.toThrow("PAPER_ACCOUNT_ACTOR_ID_REQUIRED");
    expect(runCount).toBe(0);
  });

  it("rejects blank idempotencyKey", async () => {
    const ctx = fullFakeContext(); let runCount = 0;
    const uow = createFakeUnitOfWork(ctx, () => { runCount += 1; });
    const svc = createPaperAccountCashAdjustmentService(uow);
    await expect(svc.adjustPaperAccountCash(validAdjustment({ idempotencyKey: "   " }))).rejects.toThrow("PAPER_ACCOUNT_IDEMPOTENCY_KEY_REQUIRED");
    expect(runCount).toBe(0);
  });

  const invalidDates = ["not-a-date", "2026-08-04", "2026-08-04T00:00:00Z", "2026-08-04T08:00:00.000+08:00", "+010000-01-01T00:00:00.000Z", "2026-02-30T00:00:00.000Z"];
  it.each(invalidDates)("rejects non-canonical date %s", async (dv: string) => {
    const ctx = fullFakeContext(); let runCount = 0;
    const uow = createFakeUnitOfWork(ctx, () => { runCount += 1; });
    const svc = createPaperAccountCashAdjustmentService(uow);
    await expect(svc.adjustPaperAccountCash(validAdjustment({ occurredAt: dv }))).rejects.toThrow("PAPER_ACCOUNT_DATE_INVALID");
    expect(runCount).toBe(0);
  });

  // 2 ── Amount / direction / version validation ─────────────────────────

  it("rejects zero amount", async () => {
    const ctx = fullFakeContext(); let runCount = 0;
    const uow = createFakeUnitOfWork(ctx, () => { runCount += 1; });
    const svc = createPaperAccountCashAdjustmentService(uow);
    await expect(svc.adjustPaperAccountCash(validAdjustment({ amountFen: BigInt("0") }))).rejects.toThrow("PAPER_ACCOUNT_ADJUSTMENT_AMOUNT_INVALID");
    expect(runCount).toBe(0);
  });

  it("rejects negative amount", async () => {
    const ctx = fullFakeContext(); let runCount = 0;
    const uow = createFakeUnitOfWork(ctx, () => { runCount += 1; });
    const svc = createPaperAccountCashAdjustmentService(uow);
    await expect(svc.adjustPaperAccountCash(validAdjustment({ amountFen: BigInt("-1") }))).rejects.toThrow("PAPER_ACCOUNT_ADJUSTMENT_AMOUNT_INVALID");
    expect(runCount).toBe(0);
  });

  it("rejects invalid direction", async () => {
    const ctx = fullFakeContext(); let runCount = 0;
    const uow = createFakeUnitOfWork(ctx, () => { runCount += 1; });
    const svc = createPaperAccountCashAdjustmentService(uow);
    await expect(
      svc.adjustPaperAccountCash({ ...validAdjustment(), direction: "invalid-direction" as unknown as PaperAccountCashAdjustmentDirection }),
    ).rejects.toThrow("PAPER_ACCOUNT_ADJUSTMENT_DIRECTION_INVALID");
    expect(runCount).toBe(0);
  });

  const invalidVersions = [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1] as const;
  it.each(invalidVersions)("rejects invalid expectedAccountVersion %s", async (v: number) => {
    const ctx = fullFakeContext(); let runCount = 0;
    const uow = createFakeUnitOfWork(ctx, () => { runCount += 1; });
    const svc = createPaperAccountCashAdjustmentService(uow);
    await expect(svc.adjustPaperAccountCash(validAdjustment({ expectedAccountVersion: v as number }))).rejects.toThrow("PAPER_ACCOUNT_ACCOUNT_VERSION_INVALID");
    expect(runCount).toBe(0);
  });

  // 3 ── No trimming ─────────────────────────────────────────────────────

  it("preserves whitespace in strings", async () => {
    const acct = accountRecord({ id: "  acc-1  " });
    const acct2 = accountRecord({ id: "  acc-1  ", availableCashFen: BigInt("11000000"), accountVersion: 2 });
    const led = ledgerEntry({ id: "led-1", balanceAfterFen: BigInt("11000000") });
    const aud = auditEntry({ id: "aud-1" });
    const updateCash = vi.fn().mockResolvedValue(acct2);
    const ledgerAppend = vi.fn().mockResolvedValue(led);
    const auditAppend = vi.fn().mockResolvedValue(aud);

    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(acct), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash },
      ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(null), listByAccount: vi.fn().mockResolvedValue([ledgerEntry({ sequence: 2 })]), sumByAccount: unexpectedRepositoryCall, append: ledgerAppend },
      audit: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([auditEntry({ sequence: 3 })]), append: auditAppend },
    });

    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    await svc.adjustPaperAccountCash(validAdjustment({
      accountId: "  acc-1  ", reason: "  bonus  ", actorId: "  op  ", idempotencyKey: "  adj-key  ",
    }));

    const lc = ledgerAppend.mock.calls[0][0] as CashLedgerEntryInput;
    const m = JSON.parse(lc.metadataJson!);
    expect(m.reason).toBe("  bonus  ");
    expect(m.actorId).toBe("  op  ");
    expect(lc.idempotencyKey).toBe("  adj-key  ");

    const ac = auditAppend.mock.calls[0][0] as PaperAuditLogInput;
    expect(ac.actorId).toBe("  op  ");
    expect(ac.idempotencyKey).toBe("  adj-key  :audit");
  });

  // 4 ── Idempotent return ───────────────────────────────────────────────

  it("returns existing result on idempotent hit", async () => {
    const existing = ledgerEntry({ id: "existing-ledger", balanceAfterFen: BigInt("12000000") });
    existing.metadataJson = JSON.stringify({ reason: "bonus", actorId: "operator", direction: "credit", amountFen: "1000000", occurredAt: "2026-08-04T02:00:00.000Z", accountVersionBefore: 1, accountVersionAfter: 2, availableCashAfterFen: "11000000" });

    const ctx = fullFakeContext({ ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(existing), listByAccount: unexpectedRepositoryCall, sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall } });
    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    const result = await svc.adjustPaperAccountCash(validAdjustment());

    expect(result).toEqual({ ledgerEntryId: "existing-ledger", availableCashFen: BigInt("11000000"), accountVersion: 2, created: false });
  });

  // 5 ── Idempotent conflict ─────────────────────────────────────────────

  it("rejects idempotent hit with wrong accountId", async () => {
    const existing = ledgerEntry({ accountId: "other-account" });
    const ctx = fullFakeContext({ ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(existing), listByAccount: unexpectedRepositoryCall, sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall } });
    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    await expect(svc.adjustPaperAccountCash(validAdjustment())).rejects.toThrow("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
  });

  it("rejects idempotent hit with wrong amountFen", async () => {
    const existing = ledgerEntry();
    existing.metadataJson = JSON.stringify({ reason: "bonus", actorId: "operator", direction: "credit", amountFen: "999999", occurredAt: "2026-08-04T02:00:00.000Z", accountVersionBefore: 1, accountVersionAfter: 2, availableCashAfterFen: "11000000" });
    const ctx = fullFakeContext({ ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(existing), listByAccount: unexpectedRepositoryCall, sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall } });
    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    await expect(svc.adjustPaperAccountCash(validAdjustment())).rejects.toThrow("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
  });

  // 6 ── Invalid metadata ────────────────────────────────────────────────

  it("rejects null metadataJson", async () => {
    const existing = ledgerEntry({ metadataJson: null });
    const ctx = fullFakeContext({ ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(existing), listByAccount: unexpectedRepositoryCall, sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall } });
    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    await expect(svc.adjustPaperAccountCash(validAdjustment())).rejects.toThrow("PAPER_ACCOUNT_CASH_ADJUSTMENT_METADATA_INVALID");
  });

  it("rejects metadata missing accountVersionAfter", async () => {
    const existing = ledgerEntry();
    existing.metadataJson = JSON.stringify({ reason: "bonus", actorId: "operator", direction: "credit", amountFen: "1000000", occurredAt: "2026-08-04T02:00:00.000Z", accountVersionBefore: 1, availableCashAfterFen: "11000000" });
    const ctx = fullFakeContext({ ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(existing), listByAccount: unexpectedRepositoryCall, sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall } });
    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    await expect(svc.adjustPaperAccountCash(validAdjustment())).rejects.toThrow("PAPER_ACCOUNT_CASH_ADJUSTMENT_METADATA_INVALID");
  });

  // 7 ── Account not found ───────────────────────────────────────────────

  it("rejects when account does not exist", async () => {
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(null), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(null), listByAccount: unexpectedRepositoryCall, sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    await expect(svc.adjustPaperAccountCash(validAdjustment())).rejects.toThrow("PAPER_ACCOUNT_ACCOUNT_NOT_FOUND");
  });

  // 8 ── Version conflict ────────────────────────────────────────────────

  it("rejects version conflict", async () => {
    const acct = accountRecord({ accountVersion: 5 });
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(acct), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(null), listByAccount: unexpectedRepositoryCall, sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    await expect(svc.adjustPaperAccountCash(validAdjustment({ expectedAccountVersion: 3 }))).rejects.toThrow("ACCOUNT_VERSION_CONFLICT");
  });

  // 9 ── Insufficient cash ───────────────────────────────────────────────

  it("rejects debit with insufficient balance", async () => {
    const acct = accountRecord({ availableCashFen: BigInt("500000") });
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(acct), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(null), listByAccount: unexpectedRepositoryCall, sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    await expect(svc.adjustPaperAccountCash(validAdjustment({ direction: "debit" as PaperAccountCashAdjustmentDirection, amountFen: BigInt("1000000") }))).rejects.toThrow("PAPER_ACCOUNT_INSUFFICIENT_CASH");
  });

  // 10 ── Credit success contract ────────────────────────────────────────

  it("completes credit adjustment with exact contract", async () => {
    const acct = accountRecord({ availableCashFen: BigInt("10000000"), frozenCashFen: BigInt("200000"), accountVersion: 3 });
    const updAccount = accountRecord({ id: "account-1", availableCashFen: BigInt("11000000"), frozenCashFen: BigInt("200000"), accountVersion: 4 });
    const totalCashFen = updAccount.availableCashFen + updAccount.frozenCashFen;
    const led = ledgerEntry({ id: "new-ledger", balanceAfterFen: totalCashFen, sequence: 5 });
    const aud = auditEntry({ id: "new-audit", sequence: 8 });

    const updateCash = vi.fn().mockResolvedValue(updAccount);
    const ledgerAppend = vi.fn().mockResolvedValue(led);
    const auditAppend = vi.fn().mockResolvedValue(aud);
    let runCount = 0;

    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(acct), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash },
      ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(null), listByAccount: vi.fn().mockResolvedValue([ledgerEntry({ sequence: 1 }), ledgerEntry({ sequence: 4 })]), sumByAccount: unexpectedRepositoryCall, append: ledgerAppend },
      audit: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([auditEntry({ sequence: 2 }), auditEntry({ sequence: 7 })]), append: auditAppend },
    });

    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx, () => { runCount += 1; }));
    const result = await svc.adjustPaperAccountCash(validAdjustment({
      amountFen: BigInt("1000000"), expectedAccountVersion: 3, idempotencyKey: "credit-test",
    }));

    expect(runCount).toBe(1);

    const uc = updateCash.mock.calls[0][0] as UpdatePaperAccountCashInput;
    expect(uc).toEqual({ accountId: "account-1", availableCashFen: BigInt("11000000"), frozenCashFen: BigInt("200000"), expectedAccountVersion: 3 });

    const lc = ledgerAppend.mock.calls[0][0] as CashLedgerEntryInput;
    expect(lc.sequence).toBe(5);
    expect(lc.direction).toBe("credit");
    expect(lc.type).toBe("cash_adjustment");
    expect(lc.amountFen).toBe(BigInt("1000000"));
    expect(lc.balanceAfterFen).toBe(totalCashFen);
    expect(lc.orderId).toBeNull();

    const m = JSON.parse(lc.metadataJson!);
    expect(m).toEqual({ reason: "bonus", actorId: "operator", direction: "credit", amountFen: "1000000", occurredAt: "2026-08-04T02:00:00.000Z", accountVersionBefore: 3, accountVersionAfter: 4, availableCashAfterFen: "11000000" });

    const ac = auditAppend.mock.calls[0][0] as PaperAuditLogInput;
    expect(ac.sequence).toBe(8);
    expect(ac.action).toBe("cash_adjusted");
    expect(ac.entityType).toBe("CashLedgerEntry");
    expect(ac.entityId).toBe("new-ledger");

    expect(result).toEqual({ ledgerEntryId: "new-ledger", availableCashFen: BigInt("11000000"), accountVersion: 4, created: true });
  });

  it("returns available cash rather than total cash on idempotent replay", async () => {
    const existingLedger = ledgerEntry({
      id: "existing-ledger-1",
      accountId: "account-1",
      type: "cash_adjustment" as CashLedgerType,
      direction: "credit",
      amountFen: BigInt("1000000"),
      balanceAfterFen: BigInt("11200000"),
      idempotencyKey: "replay-key",
      metadataJson: JSON.stringify({
        reason: "bonus",
        actorId: "operator",
        direction: "credit",
        amountFen: "1000000",
        occurredAt: "2026-08-04T02:00:00.000Z",
        accountVersionBefore: 3,
        accountVersionAfter: 4,
        availableCashAfterFen: "11000000",
      }),
    });
    let runCount = 0;
    const ctx = fullFakeContext({
      ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(existingLedger), listByAccount: unexpectedRepositoryCall, sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx, () => { runCount += 1; }));
    const result = await svc.adjustPaperAccountCash(validAdjustment({
      amountFen: BigInt("1000000"), expectedAccountVersion: 3, idempotencyKey: "replay-key",
    }));
    expect(runCount).toBe(1);
    expect(result).toEqual({ ledgerEntryId: "existing-ledger-1", availableCashFen: BigInt("11000000"), accountVersion: 4, created: false });
    expect(result.availableCashFen).not.toBe(BigInt("11200000"));
  });

  // 11 ── Debit success ──────────────────────────────────────────────────

  it("completes debit adjustment", async () => {
    const acct = accountRecord({ availableCashFen: BigInt("10000000"), accountVersion: 1 });
    const updAcct = accountRecord({ availableCashFen: BigInt("7500000"), accountVersion: 2 });
    const led = ledgerEntry({ id: "deb-ledger", balanceAfterFen: BigInt("7500000"), sequence: 1 });
    const aud = auditEntry({ id: "deb-audit", sequence: 1 });

    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(acct), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: vi.fn().mockResolvedValue(updAcct) },
      ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(null), listByAccount: vi.fn().mockResolvedValue([]), sumByAccount: unexpectedRepositoryCall, append: vi.fn().mockResolvedValue(led) },
      audit: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: vi.fn().mockResolvedValue(aud) },
    });

    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    const result = await svc.adjustPaperAccountCash(validAdjustment({
      direction: "debit" as PaperAccountCashAdjustmentDirection, amountFen: BigInt("2500000"),
    }));

    expect(result.availableCashFen).toBe(BigInt("7500000"));
  });

  // 12 ── Empty history starts at 1 ──────────────────────────────────────

  it("starts sequences at 1 when history is empty", async () => {
    const acct = accountRecord({ accountVersion: 1 });
    const updAcct = accountRecord({ accountVersion: 2 });
    const led = ledgerEntry({ sequence: 1 });
    const aud = auditEntry({ sequence: 1 });
    const ledgerAppend = vi.fn().mockResolvedValue(led);
    const auditAppend = vi.fn().mockResolvedValue(aud);

    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(acct), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: vi.fn().mockResolvedValue(updAcct) },
      ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(null), listByAccount: vi.fn().mockResolvedValue([]), sumByAccount: unexpectedRepositoryCall, append: ledgerAppend },
      audit: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: auditAppend },
    });

    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    await svc.adjustPaperAccountCash(validAdjustment());

    const lc = ledgerAppend.mock.calls[0][0] as CashLedgerEntryInput;
    const ac = auditAppend.mock.calls[0][0] as PaperAuditLogInput;
    expect(lc.sequence).toBe(1);
    expect(ac.sequence).toBe(1);
  });

  // 13 ── Sequence overflow ──────────────────────────────────────────────

  it("rejects ledger sequence overflow", async () => {
    const acct = accountRecord({ accountVersion: 1 });
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(acct), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(null), listByAccount: vi.fn().mockResolvedValue([ledgerEntry({ sequence: Number.MAX_SAFE_INTEGER })]), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      audit: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    await expect(svc.adjustPaperAccountCash(validAdjustment())).rejects.toThrow("PAPER_ACCOUNT_LEDGER_SEQUENCE_INVALID");
  });

  // 14 ── updateCash returns wrong version ───────────────────────────────

  it("rejects when updateCash returns unexpected version", async () => {
    const acct = accountRecord({ accountVersion: 3 });
    const bad = accountRecord({ accountVersion: 5 });
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(acct), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: vi.fn().mockResolvedValue(bad) },
      ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(null), listByAccount: vi.fn().mockResolvedValue([]), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      audit: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    await expect(svc.adjustPaperAccountCash(validAdjustment({ expectedAccountVersion: 3 }))).rejects.toThrow("PAPER_ACCOUNT_ACCOUNT_VERSION_INVALID");
  });

  // 15 ── Ledger append failure propagates ───────────────────────────────

  it("propagates ledger append failure", async () => {
    const acct = accountRecord({ accountVersion: 1 });
    const upd = accountRecord({ accountVersion: 2 });
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(acct), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: vi.fn().mockResolvedValue(upd) },
      ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(null), listByAccount: vi.fn().mockResolvedValue([]), sumByAccount: unexpectedRepositoryCall, append: vi.fn().mockRejectedValue(new Error("LEDGER_APPEND_FAILED")) },
      audit: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    await expect(svc.adjustPaperAccountCash(validAdjustment())).rejects.toThrow("LEDGER_APPEND_FAILED");
  });

  // 16 ── Audit append failure propagates ────────────────────────────────

  it("propagates audit append failure", async () => {
    const acct = accountRecord({ accountVersion: 1 });
    const upd = accountRecord({ accountVersion: 2 });
    const led = ledgerEntry({ sequence: 1 });
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(acct), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: vi.fn().mockResolvedValue(upd) },
      ledger: { findByIdempotencyKey: vi.fn().mockResolvedValue(null), listByAccount: vi.fn().mockResolvedValue([]), sumByAccount: unexpectedRepositoryCall, append: vi.fn().mockResolvedValue(led) },
      audit: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: vi.fn().mockRejectedValue(new Error("AUDIT_APPEND_FAILED")) },
    });
    const svc = createPaperAccountCashAdjustmentService(createFakeUnitOfWork(ctx));
    await expect(svc.adjustPaperAccountCash(validAdjustment())).rejects.toThrow("AUDIT_APPEND_FAILED");
  });
});