import { describe, expect, it, vi } from "vitest";
import type { CashLedgerType } from "@prisma/client";
import type {
  PaperAccountTransactionContext,
  PaperAccountUnitOfWork,
} from "./paper-account-unit-of-work";
import type {
  CashLedgerEntryRecord,
  PaperAccountRecord,
  PaperAccountSettingsVersionRecord,
  PaperFillRecord,
  PaperLotRecord,
  PaperPositionRecord,
} from "./paper-account-repositories";
import type { } from "./paper-account-integrity-service";
import { createPaperAccountIntegrityService } from "./paper-account-integrity-service";

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

function acct(overrides: Partial<PaperAccountRecord> = {}): PaperAccountRecord {
  return { id: "account-1", accountKey: "paper-key", initialCashFen: BigInt("10000000"), availableCashFen: BigInt("9500000"), frozenCashFen: BigInt("500000"), realizedPnlFen: BigInt("100000"), cumulativeFeesFen: BigInt("2500"), accountVersion: 1, status: "active", createdAt: "2026-08-05T00:00:00.000Z", updatedAt: "2026-08-05T00:00:00.000Z", ...overrides };
}

function settings(overrides: Partial<PaperAccountSettingsVersionRecord> = {}): PaperAccountSettingsVersionRecord {
  return { id: "settings-1", scopeKey: "account:account-1", accountId: "account-1", version: 1, initialCashForNewAccountsFen: null, commissionRatePpm: 250, minimumCommissionFen: BigInt("500"), stampDutySellRatePpm: 500, transferFeeRatePpm: 10, maxSingleStockBp: 3000, maxTotalPositionBp: 8000, maxRiskBp: 200, actorId: "test", idempotencyKey: "sk", createdAt: "2026-08-05T00:00:00.000Z", ...overrides };
}

function ledgerEntry(overrides: Partial<CashLedgerEntryRecord> = {}): CashLedgerEntryRecord {
  return { id: "led-1", accountId: "account-1", orderId: null, sequence: 1, direction: "credit", type: "initial_cash" as CashLedgerType, amountFen: BigInt("10000000"), balanceAfterFen: BigInt("10000000"), idempotencyKey: "key-1", metadataJson: "{}", occurredAt: "2026-08-05T00:00:00.000Z", createdAt: "2026-08-05T00:00:00.000Z", ...overrides };
}

function fill(overrides: Partial<PaperFillRecord> = {}): PaperFillRecord {
  return { id: "fill-1", orderId: "order-1", sequence: 1, quantity: 100, priceFen: BigInt("1000"), notionalFen: BigInt("100000"), commissionFen: BigInt("500"), stampDutyFen: BigInt("500"), transferFeeFen: BigInt("1500"), tradingDate: "2026-08-04", executedAt: "2026-08-04T00:00:00.000Z", createdAt: "2026-08-04T00:00:00.000Z", ...overrides };
}

function pos(overrides: Partial<PaperPositionRecord> = {}): PaperPositionRecord {
  return { id: "pos-1", accountId: "account-1", code: "000001", totalQuantity: 100, sellableQuantity: 100, frozenQuantity: 0, averageCostFen: BigInt("1000"), realizedPnlFen: BigInt("0"), version: 1, createdAt: "2026-08-05T00:00:00.000Z", updatedAt: "2026-08-05T00:00:00.000Z", ...overrides };
}

function lot(overrides: Partial<PaperLotRecord> = {}): PaperLotRecord {
  return { id: "lot-1", positionId: "pos-1", acquiredSequence: 1, acquiredTradingDate: "2026-08-04", sellableTradingDate: "2026-08-05", originalQuantity: 100, remainingQuantity: 100, priceFen: BigInt("1000"), buyFeeFen: BigInt("2500"), createdAt: "2026-08-04T00:00:00.000Z", ...overrides };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PaperAccountIntegrityService (unit)", () => {
  // 1 ── Blank accountId ─────────────────────────────────────────────────

  it("rejects blank accountId", async () => {
    const ctx = fullFakeContext(); let runCount = 0;
    const uow = createFakeUnitOfWork(ctx, () => { runCount += 1; });
    const svc = createPaperAccountIntegrityService(uow);
    await expect(svc.checkPaperAccountIntegrity("   ")).rejects.toThrow("PAPER_ACCOUNT_ACCOUNT_ID_REQUIRED");
    expect(runCount).toBe(0);
  });

  // 2 ── No trimming ─────────────────────────────────────────────────────

  it("preserves whitespace in accountId", async () => {
    const a = acct({ id: "  acc-1  " });
    const s = settings({ scopeKey: "account:  acc-1  " });
    const findById = vi.fn().mockResolvedValue(a);
    const findSettings = vi.fn().mockResolvedValue(s);

    const ctx = fullFakeContext({
      accounts: { findById, findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: findSettings, listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    await svc.checkPaperAccountIntegrity("  acc-1  ");
    expect(findById).toHaveBeenCalledWith("  acc-1  ");
    expect(findSettings).toHaveBeenCalledWith("account:  acc-1  ");
  });

  // 3 ── Account not found ───────────────────────────────────────────────

  it("rejects when account not found", async () => {
    const ctx = fullFakeContext({ accounts: { findById: vi.fn().mockResolvedValue(null), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall } });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    await expect(svc.checkPaperAccountIntegrity("account-1")).rejects.toThrow("PAPER_ACCOUNT_ACCOUNT_NOT_FOUND");
  });

  // 4 ── Fully consistent account ────────────────────────────────────────

  it("returns valid for fully consistent account", async () => {
    const a = acct({ availableCashFen: BigInt("9500000"), frozenCashFen: BigInt("500000") });
    const s = settings();
    const entries = [
      ledgerEntry({ sequence: 1, direction: "credit", type: "initial_cash" as CashLedgerType, amountFen: BigInt("10000000"), balanceAfterFen: BigInt("10000000") }),
    ];
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(s), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue(entries), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([pos()]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      lots: { listByPosition: vi.fn().mockResolvedValue([lot()]), listSellableByPosition: unexpectedRepositoryCall, append: unexpectedRepositoryCall, updateRemainingQuantity: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([fill()]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    const result = await svc.checkPaperAccountIntegrity("account-1");
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.ledgerCashFen).toBe(BigInt("10000000"));
    expect(result.cachedCashFen).toBe(BigInt("10000000"));
  });

  // 5 ── Settings missing ────────────────────────────────────────────────

  it("reports settings missing as issue", async () => {
    const a = acct();
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(null), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    const result = await svc.checkPaperAccountIntegrity("account-1");
    expect(result.issues[0]).toBe("PAPER_ACCOUNT_SETTINGS_MISSING");
  });

  // 6 ── Ledger sequence invalid ─────────────────────────────────────────

  it.each([2, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1] as const)("reports ledger sequence invalid: %s", async (badSeq) => {
    const badLedger = ledgerEntry({ sequence: 1 });
    Object.defineProperty(badLedger, "sequence", { value: badSeq });
    const a = acct();
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(settings()), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([badLedger as CashLedgerEntryRecord]), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    const result = await svc.checkPaperAccountIntegrity("account-1");
    expect(result.issues).toContain("PAPER_ACCOUNT_LEDGER_SEQUENCE_INVALID");
    // Should appear only once
    expect(result.issues.filter((i) => i === "PAPER_ACCOUNT_LEDGER_SEQUENCE_INVALID").length).toBe(1);
  });

  // 7 ── Ledger amount invalid ───────────────────────────────────────────

  it("reports invalid ledger amount", async () => {
    const badLedger = ledgerEntry({ sequence: 1, direction: "credit", amountFen: BigInt("10000000"), balanceAfterFen: BigInt("0") });
    Object.defineProperty(badLedger, "amountFen", { value: BigInt("-1") });
    const a = acct();
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(settings()), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([badLedger as CashLedgerEntryRecord]), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    const result = await svc.checkPaperAccountIntegrity("account-1");
    expect(result.issues).toContain("PAPER_ACCOUNT_LEDGER_AMOUNT_INVALID");
    expect(result.ledgerCashFen).toBe(BigInt("0"));
  });

  // 8 ── Balance mismatch ────────────────────────────────────────────────

  it("reports balance mismatch", async () => {
    const a = acct();
    const entries = [
      ledgerEntry({ sequence: 1, direction: "credit", amountFen: BigInt("10000000"), balanceAfterFen: BigInt("99999999") }),
    ];
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(settings()), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue(entries), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    const result = await svc.checkPaperAccountIntegrity("account-1");
    expect(result.issues).toContain("PAPER_ACCOUNT_LEDGER_BALANCE_MISMATCH");
    expect(result.ledgerCashFen).toBe(BigInt("10000000"));
  });

  // 9 ── Cash cache mismatch ─────────────────────────────────────────────

  it("reports cash cache mismatch", async () => {
    const a = acct({ availableCashFen: BigInt("8000000"), frozenCashFen: BigInt("0") });
    const entries = [
      ledgerEntry({ sequence: 1, direction: "credit", amountFen: BigInt("10000000"), balanceAfterFen: BigInt("10000000") }),
    ];
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(settings()), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue(entries), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    const result = await svc.checkPaperAccountIntegrity("account-1");
    expect(result.issues).toContain("CASH_CACHE_MISMATCH");
    expect(result.cachedCashFen).toBe(BigInt("8000000"));
  });

  // 10 ── Negative cash fields ───────────────────────────────────────────

  it("reports negative availableCashFen", async () => {
    const a = acct({ availableCashFen: BigInt("-1") });
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(settings()), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    const result = await svc.checkPaperAccountIntegrity("account-1");
    expect(result.issues).toContain("PAPER_ACCOUNT_AVAILABLE_CASH_INVALID");
  });

  // 11 ── Fee totals match ───────────────────────────────────────────────

  it("validates cumulative fees match fill totals", async () => {
    const a = acct({ cumulativeFeesFen: BigInt("2500") });
    const s = settings();
    const entries = [
      ledgerEntry({ sequence: 1, direction: "credit", amountFen: BigInt("10000000"), balanceAfterFen: BigInt("10000000") }),
    ];
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(s), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue(entries), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([fill({ commissionFen: BigInt("500"), stampDutyFen: BigInt("500"), transferFeeFen: BigInt("1500") })]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    const result = await svc.checkPaperAccountIntegrity("account-1");
    expect(result.issues.includes("CUMULATIVE_FEES_MISMATCH")).toBe(false);
  });

  // 12 ── Invalid fill fee ───────────────────────────────────────────────

  it("reports invalid fill fee", async () => {
    const badFill = fill({ commissionFen: BigInt("500") });
    Object.defineProperty(badFill, "commissionFen", { value: BigInt("-1") });
    const a = acct({ cumulativeFeesFen: BigInt("2000") });
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(settings()), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([ledgerEntry()]), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([badFill as PaperFillRecord]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    const result = await svc.checkPaperAccountIntegrity("account-1");
    expect(result.issues).toContain("PAPER_ACCOUNT_FILL_FEE_INVALID");
  });

  // 13 ── Cumulative fees mismatch ───────────────────────────────────────

  it("reports cumulative fees mismatch", async () => {
    const a = acct({ cumulativeFeesFen: BigInt("9999") });
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(settings()), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([ledgerEntry()]), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([fill({ commissionFen: BigInt("500"), stampDutyFen: BigInt("500"), transferFeeFen: BigInt("1500") })]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    const result = await svc.checkPaperAccountIntegrity("account-1");
    expect(result.issues).toContain("CUMULATIVE_FEES_MISMATCH");
  });

  // 14 ── Position quantity invalid ──────────────────────────────────────

  it("reports invalid position quantity", async () => {
    const badPos = pos({ code: "000001", sellableQuantity: 150 });
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(acct()), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(settings()), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([ledgerEntry()]), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([badPos]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      lots: { listByPosition: vi.fn().mockResolvedValue([lot()]), listSellableByPosition: unexpectedRepositoryCall, append: unexpectedRepositoryCall, updateRemainingQuantity: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    const result = await svc.checkPaperAccountIntegrity("account-1");
    expect(result.issues).toContain("PAPER_ACCOUNT_POSITION_QUANTITY_INVALID:000001");
  });

  // 15 ── Lot quantity invalid ───────────────────────────────────────────

  it("reports invalid lot quantity", async () => {
    const badLot = lot({ remainingQuantity: 200 });
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(acct()), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(settings()), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([ledgerEntry()]), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([pos()]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      lots: { listByPosition: vi.fn().mockResolvedValue([badLot]), listSellableByPosition: unexpectedRepositoryCall, append: unexpectedRepositoryCall, updateRemainingQuantity: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    const result = await svc.checkPaperAccountIntegrity("account-1");
    expect(result.issues).toContain("PAPER_ACCOUNT_LOT_QUANTITY_INVALID:000001");
  });

  // 16 ── Position lot quantity mismatch ─────────────────────────────────

  it("reports position lot mismatch", async () => {
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(acct()), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(settings()), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([ledgerEntry()]), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([pos({ totalQuantity: 200 })]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      lots: { listByPosition: vi.fn().mockResolvedValue([lot({ remainingQuantity: 100 }), lot({ id: "lot-2", remainingQuantity: 50 })]), listSellableByPosition: unexpectedRepositoryCall, append: unexpectedRepositoryCall, updateRemainingQuantity: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    const result = await svc.checkPaperAccountIntegrity("account-1");
    expect(result.issues).toContain("POSITION_LOT_QUANTITY_MISMATCH:000001");
  });

  // 17 ── Issues order and dedup ─────────────────────────────────────────

  it("reports issues in deterministic order without duplicates", async () => {
    const a = acct({ availableCashFen: BigInt("-1"), frozenCashFen: BigInt("-1"), cumulativeFeesFen: BigInt("9999") });
    const entries = [
      ledgerEntry({ sequence: 1, direction: "credit", amountFen: BigInt("10000000"), balanceAfterFen: BigInt("5000000") }),
    ];
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(settings()), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      ledger: { findByIdempotencyKey: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue(entries), sumByAccount: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([pos({ code: "600000", sellableQuantity: 150 }), pos({ id: "pos-2", code: "000001", totalQuantity: 200 })]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
      lots: { listByPosition: vi.fn().mockResolvedValue([lot({ remainingQuantity: 100 }), lot({ id: "lot-2", remainingQuantity: 50 })]), listSellableByPosition: unexpectedRepositoryCall, append: unexpectedRepositoryCall, updateRemainingQuantity: unexpectedRepositoryCall },
      fills: { findByOrderAndSequence: unexpectedRepositoryCall, listByOrder: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([fill()]), append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    const result = await svc.checkPaperAccountIntegrity("account-1");

    // Expected order: ledger issues → cash fields → cash cache → fees → cum fee mismatch → position/lot by code asc
    const expected = [
      "PAPER_ACCOUNT_LEDGER_BALANCE_MISMATCH",
      "PAPER_ACCOUNT_AVAILABLE_CASH_INVALID",
      "PAPER_ACCOUNT_FROZEN_CASH_INVALID",
      "CASH_CACHE_MISMATCH",
      "CUMULATIVE_FEES_MISMATCH",
      "POSITION_LOT_QUANTITY_MISMATCH:000001",
      "PAPER_ACCOUNT_POSITION_QUANTITY_INVALID:600000",
      "POSITION_LOT_QUANTITY_MISMATCH:600000",
    ];

    expect(result.issues).toEqual(expected);
    expect(result.valid).toBe(false);
  });

  // 18 ── Repository error propagates ────────────────────────────────────

  it("propagates repository read failure", async () => {
    const ctx = fullFakeContext({ accounts: { findById: vi.fn().mockRejectedValue(new Error("READ_FAILED")), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall } });
    const svc = createPaperAccountIntegrityService(createFakeUnitOfWork(ctx));
    await expect(svc.checkPaperAccountIntegrity("account-1")).rejects.toThrow("READ_FAILED");
  });
});