import { describe, expect, it, vi } from "vitest";
import type { PriceFen } from "@/lib/paper-account/paper-account-types";
import type {
  PaperAccountTransactionContext,
  PaperAccountUnitOfWork,
} from "./paper-account-unit-of-work";
import type {
  PaperAccountRecord,
  PaperAccountSettingsVersionRecord,
  PaperPositionRecord,
} from "./paper-account-repositories";
import type {
  PaperAccountQuote,
  PaperAccountQuoteReader,
} from "./paper-account-quote-port";
import type {
  PaperAccountSnapshot,
} from "./paper-account-snapshot-service";
import {
  createPaperAccountSnapshotService,
  serializePaperAccountSnapshot,
} from "./paper-account-snapshot-service";
// ── Helpers ────────────────────────────────────────────────────────────────

async function unexpectedRepositoryCall(): Promise<never> {
  throw new Error("UNEXPECTED_REPOSITORY_CALL");
}

function createFakeUnitOfWork(
  context: PaperAccountTransactionContext,
  onRun?: () => void,
): PaperAccountUnitOfWork {
  return {
    async run<T>(
      work: (ctx: PaperAccountTransactionContext) => Promise<T>,
    ): Promise<T> {
      onRun?.();
      return work(context);
    },
  };
}

function fullFakeContext(
  overrides: Partial<PaperAccountTransactionContext> = {},
): PaperAccountTransactionContext {
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
  return {
    id: "account-1", accountKey: "paper-key", initialCashFen: BigInt("10000000"), availableCashFen: BigInt("9000000"), frozenCashFen: BigInt("1000000"), realizedPnlFen: BigInt("500000"), cumulativeFeesFen: BigInt("2500"), accountVersion: 1, status: "active", createdAt: "2026-08-05T00:00:00.000Z", updatedAt: "2026-08-05T00:00:00.000Z", ...overrides,
  };
}

function settings(overrides: Partial<PaperAccountSettingsVersionRecord> = {}): PaperAccountSettingsVersionRecord {
  return { id: "settings-1", scopeKey: "account:account-1", accountId: "account-1", version: 3, initialCashForNewAccountsFen: null, commissionRatePpm: 250, minimumCommissionFen: BigInt("500"), stampDutySellRatePpm: 500, transferFeeRatePpm: 10, maxSingleStockBp: 3000, maxTotalPositionBp: 8000, maxRiskBp: 200, actorId: "test", idempotencyKey: "sk", createdAt: "2026-08-05T00:00:00.000Z", ...overrides };
}

function pos(overrides: Partial<PaperPositionRecord> = {}): PaperPositionRecord {
  return { id: "pos-1", accountId: "account-1", code: "000001", totalQuantity: 100, sellableQuantity: 100, frozenQuantity: 0, averageCostFen: BigInt("1000"), realizedPnlFen: BigInt("0"), version: 1, createdAt: "2026-08-05T00:00:00.000Z", updatedAt: "2026-08-05T00:00:00.000Z", ...overrides };
}

function freshQuote(priceFen: PriceFen): PaperAccountQuote {
  return { priceFen, status: "fresh", observedAt: "2026-08-05T01:00:00.000Z" };
}

function fakeQuoteReader(quotes: Map<string, PaperAccountQuote>): PaperAccountQuoteReader {
  return { async getLatestQuotes() { return quotes; } };
}

const validAccountId = "account-1";

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PaperAccountSnapshotService (unit)", () => {
  // 1 ── Blank accountId ─────────────────────────────────────────────────

  it("rejects blank accountId before transaction", async () => {
    const ctx = fullFakeContext(); let runCount = 0;
    const uow = createFakeUnitOfWork(ctx, () => { runCount += 1; });
    const svc = createPaperAccountSnapshotService(uow);
    const qr = fakeQuoteReader(new Map());
    const qrSpy = vi.spyOn(qr, "getLatestQuotes");

    await expect(svc.getPaperAccountSnapshot({ accountId: "   ", quoteReader: qr })).rejects.toThrow("PAPER_ACCOUNT_ACCOUNT_ID_REQUIRED");
    expect(runCount).toBe(0);
    expect(qrSpy).not.toHaveBeenCalled();
  });

  // 2 ── No trimming ─────────────────────────────────────────────────────

  it("preserves whitespace in accountId", async () => {
    const a = acct({ id: "  account-1  " });
    const s = settings({ id: "s1", scopeKey: "account:  account-1  ", accountId: "  account-1  " });
    const findById = vi.fn().mockResolvedValue(a);
    const findLatestByScope = vi.fn().mockResolvedValue(s);
    const listByAccount = vi.fn().mockResolvedValue([]);

    const ctx = fullFakeContext({
      accounts: { findById, findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope, listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount, create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
    });

    const svc = createPaperAccountSnapshotService(createFakeUnitOfWork(ctx));
    await svc.getPaperAccountSnapshot({ accountId: "  account-1  ", quoteReader: fakeQuoteReader(new Map()) });

    expect(findById).toHaveBeenCalledWith("  account-1  ");
    expect(findLatestByScope).toHaveBeenCalledWith("account:  account-1  ");
    expect(listByAccount).toHaveBeenCalledWith("  account-1  ");
  });

  // 3 ── Account not found ───────────────────────────────────────────────

  it("rejects when account does not exist", async () => {
    const ctx = fullFakeContext({ accounts: { findById: vi.fn().mockResolvedValue(null), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall } });
    const svc = createPaperAccountSnapshotService(createFakeUnitOfWork(ctx));
    await expect(svc.getPaperAccountSnapshot({ accountId: validAccountId, quoteReader: fakeQuoteReader(new Map()) })).rejects.toThrow("PAPER_ACCOUNT_ACCOUNT_NOT_FOUND");
  });

  // 4 ── Settings not found ──────────────────────────────────────────────

  it("rejects when settings not found", async () => {
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(acct()), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(null), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountSnapshotService(createFakeUnitOfWork(ctx));
    await expect(svc.getPaperAccountSnapshot({ accountId: validAccountId, quoteReader: fakeQuoteReader(new Map()) })).rejects.toThrow("PAPER_ACCOUNT_SETTINGS_NOT_FOUND");
  });

  // 5 ── No positions ────────────────────────────────────────────────────

  it("returns fresh snapshot when no positions", async () => {
    const a = acct();
    const s = settings();
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(s), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
    });

    const svc = createPaperAccountSnapshotService(createFakeUnitOfWork(ctx));
    const qr = fakeQuoteReader(new Map());
    const spy = vi.spyOn(qr, "getLatestQuotes");
    const result = await svc.getPaperAccountSnapshot({ accountId: validAccountId, quoteReader: qr });

    expect(spy).not.toHaveBeenCalled();
    expect(result).toEqual({
      accountId: a.id,
      availableCashFen: BigInt("9000000"),
      frozenCashFen: BigInt("1000000"),
      positionMarketValueFen: BigInt("0"),
      totalAssetsFen: BigInt("10000000"),
      realizedPnlFen: BigInt("500000"),
      cumulativeFeesFen: BigInt("2500"),
      settingsVersion: 3,
      quoteStatus: "fresh",
    });
  });

  // 6 ── Zero-quantity positions skip quote ──────────────────────────────

  it("skips quote for zero totalQuantity positions", async () => {
    const a = acct();
    const s = settings();
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(s), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([pos({ totalQuantity: 0 }), pos({ id: "pos-2", code: "000002", totalQuantity: 0 })]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
    });

    const svc = createPaperAccountSnapshotService(createFakeUnitOfWork(ctx));
    const qr = fakeQuoteReader(new Map());
    const spy = vi.spyOn(qr, "getLatestQuotes");
    const result = await svc.getPaperAccountSnapshot({ accountId: validAccountId, quoteReader: qr });

    expect(spy).not.toHaveBeenCalled();
    expect(result.positionMarketValueFen).toBe(BigInt("0"));
  });

  // 7 ── Positive positions deduplicate and sort codes ───────────────────

  it("deduplicates and sorts codes for quote", async () => {
    const a = acct();
    const s = settings();
    const positions = [
      pos({ id: "p1", code: "600000", totalQuantity: 100 }),
      pos({ id: "p2", code: "000001", totalQuantity: 50 }),
      pos({ id: "p3", code: "600000", totalQuantity: 200 }),
      pos({ id: "p4", code: "300001", totalQuantity: 150 }),
    ];

    const qr = fakeQuoteReader(new Map([
      ["000001", freshQuote(BigInt("1000"))],
      ["300001", freshQuote(BigInt("500"))],
      ["600000", freshQuote(BigInt("2000"))],
    ]));
    const spy = vi.spyOn(qr, "getLatestQuotes");

    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(s), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue(positions), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
    });

    const svc = createPaperAccountSnapshotService(createFakeUnitOfWork(ctx));
    await svc.getPaperAccountSnapshot({ accountId: validAccountId, quoteReader: qr });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(["000001", "300001", "600000"]);
  });

  // 8 ── QuoteReader called outside UnitOfWork ───────────────────────────

  it("calls quoteReader after transaction closes", async () => {
    const a = acct(); const s = settings();
    let tc = false;
    const uow = createFakeUnitOfWork(fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(s), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([pos()]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
    }), () => { tc = true; });

    const svc = createPaperAccountSnapshotService(uow);
    const qr: PaperAccountQuoteReader = { async getLatestQuotes() { expect(tc).toBe(true); return new Map([["000001", freshQuote(BigInt("1000"))]]); } };
    await svc.getPaperAccountSnapshot({ accountId: validAccountId, quoteReader: qr });
  });

  // 9 ── Fresh quotes compute market value ───────────────────────────────

  it("computes market value with all fresh quotes", async () => {
    const a = acct({ availableCashFen: BigInt("8000000"), frozenCashFen: BigInt("500000") });
    const s = settings();
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(s), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([pos({ code: "000001", totalQuantity: 100 }), pos({ id: "pos-2", code: "000002", totalQuantity: 250 })]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
    });

    const qr = fakeQuoteReader(new Map([["000001", freshQuote(BigInt("1234"))], ["000002", freshQuote(BigInt("567"))]]));
    const svc = createPaperAccountSnapshotService(createFakeUnitOfWork(ctx));
    const result = await svc.getPaperAccountSnapshot({ accountId: validAccountId, quoteReader: qr });

    expect(result.positionMarketValueFen).toBe(BigInt("100") * BigInt("1234") + BigInt("250") * BigInt("567"));
    expect(result.totalAssetsFen).toBe(BigInt("8500000") + (BigInt("100") * BigInt("1234") + BigInt("250") * BigInt("567")));
    expect(result.quoteStatus).toBe("fresh");
  });

  // 10 ── QuoteReader throws → unavailable ───────────────────────────────

  it("returns unavailable snapshot when quoteReader throws", async () => {
    const a = acct(); const s = settings();
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(s), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([pos()]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
    });
    const qr: PaperAccountQuoteReader = { async getLatestQuotes() { throw new Error("QUOTE_PROVIDER_FAILED"); } };
    const svc = createPaperAccountSnapshotService(createFakeUnitOfWork(ctx));
    const result = await svc.getPaperAccountSnapshot({ accountId: validAccountId, quoteReader: qr });

    expect(result.positionMarketValueFen).toBeNull();
    expect(result.totalAssetsFen).toBeNull();
    expect(result.quoteStatus).toBe("unavailable");
    expect(result.availableCashFen).toBe(BigInt("9000000"));
  });

  // 11 ── Missing quote → unavailable ────────────────────────────────────

  it("returns unavailable when any quote missing", async () => {
    const a = acct(); const s = settings();
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(s), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([pos(), pos({ id: "pos-2", code: "000002", totalQuantity: 50 })]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
    });
    const qr = fakeQuoteReader(new Map([["000001", freshQuote(BigInt("1000"))]]));
    const svc = createPaperAccountSnapshotService(createFakeUnitOfWork(ctx));
    const result = await svc.getPaperAccountSnapshot({ accountId: validAccountId, quoteReader: qr });
    expect(result.positionMarketValueFen).toBeNull();
    expect(result.totalAssetsFen).toBeNull();
    expect(result.quoteStatus).toBe("unavailable");
  });

  // 12 ── Non-fresh status → unavailable ─────────────────────────────────

  it.each(["delayed", "stale", "unavailable"] as const)("returns unavailable when any status is %s", async (status) => {
    const a = acct(); const s = settings();
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(s), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([pos()]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
    });
    const qr = fakeQuoteReader(new Map([["000001", { priceFen: BigInt("1000"), status, observedAt: "2026-08-05T01:00:00.000Z" }]]));
    const svc = createPaperAccountSnapshotService(createFakeUnitOfWork(ctx));
    const result = await svc.getPaperAccountSnapshot({ accountId: validAccountId, quoteReader: qr });
    expect(result.positionMarketValueFen).toBeNull();
    expect(result.quoteStatus).toBe("unavailable");
  });

  // 13 ── Invalid fresh price → unavailable ──────────────────────────────

  it.each([BigInt("0"), BigInt("-1"), "1000", 1000] as const)("returns unavailable when priceFen is invalid runtime type: %s", async (badPrice) => {
    const a = acct(); const s = settings();
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(s), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([pos()]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
    });
    const badQuote = { priceFen: BigInt("1000"), status: "fresh" as const, observedAt: "2026-08-05T01:00:00.000Z" };
    Object.defineProperty(badQuote, "priceFen", { value: badPrice });
    const qr = fakeQuoteReader(new Map([["000001", badQuote as PaperAccountQuote]]));
    const svc = createPaperAccountSnapshotService(createFakeUnitOfWork(ctx));
    const result = await svc.getPaperAccountSnapshot({ accountId: validAccountId, quoteReader: qr });
    expect(result.positionMarketValueFen).toBeNull();
    expect(result.quoteStatus).toBe("unavailable");
  });

  // 14 ── Invalid position quantity ──────────────────────────────────────

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1] as const)("rejects invalid position totalQuantity: %s", async (qty) => {
    const a = acct(); const s = settings();
    const badPos = pos({ totalQuantity: 100 });
    Object.defineProperty(badPos, "totalQuantity", { value: qty });
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(s), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([badPos]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
    });
    const svc = createPaperAccountSnapshotService(createFakeUnitOfWork(ctx));
    await expect(svc.getPaperAccountSnapshot({ accountId: validAccountId, quoteReader: fakeQuoteReader(new Map()) })).rejects.toThrow("PAPER_ACCOUNT_POSITION_QUANTITY_INVALID");
  });

  // 15 ── BigInt overflow ────────────────────────────────────────────────

  it("rejects bigint overflow in multiplication", async () => {
    const a = acct(); const s = settings();
    const ctx = fullFakeContext({
      accounts: { findById: vi.fn().mockResolvedValue(a), findByKey: unexpectedRepositoryCall, create: unexpectedRepositoryCall, updateCash: unexpectedRepositoryCall },
      settings: { findLatestByScope: vi.fn().mockResolvedValue(s), listByScope: unexpectedRepositoryCall, findByIdempotencyKey: unexpectedRepositoryCall, append: unexpectedRepositoryCall },
      positions: { findByAccountAndCode: unexpectedRepositoryCall, listByAccount: vi.fn().mockResolvedValue([pos({ code: "000001", totalQuantity: Number.MAX_SAFE_INTEGER }), pos({ id: "pos-2", code: "000002", totalQuantity: 1 })]), create: unexpectedRepositoryCall, updateWithVersion: unexpectedRepositoryCall },
    });
    const maxPrice = BigInt("9223372036854775807"); // SQLITE_INT64_MAX
    const qr = fakeQuoteReader(new Map([["000001", freshQuote(maxPrice)], ["000002", freshQuote(maxPrice)]]));
    const svc = createPaperAccountSnapshotService(createFakeUnitOfWork(ctx));
    await expect(svc.getPaperAccountSnapshot({ accountId: validAccountId, quoteReader: qr })).rejects.toThrow("PAPER_ACCOUNT_BIGINT_OUT_OF_RANGE");
  });

  // 16 ── Snapshot serialization ─────────────────────────────────────────

  it("serializes snapshot correctly", () => {
    const snap: PaperAccountSnapshot = {
      accountId: "acc-1", availableCashFen: BigInt("9000000"), frozenCashFen: BigInt("1000000"), positionMarketValueFen: BigInt("500000"), totalAssetsFen: BigInt("10500000"), realizedPnlFen: BigInt("500000"), cumulativeFeesFen: BigInt("2500"), settingsVersion: 3, quoteStatus: "fresh",
    };

    const dto = serializePaperAccountSnapshot(snap);
    expect(dto.availableCashFen).toBe("9000000");
    expect(dto.frozenCashFen).toBe("1000000");
    expect(dto.positionMarketValueFen).toBe("500000");
    expect(dto.totalAssetsFen).toBe("10500000");
    expect(dto.realizedPnlFen).toBe("500000");
    expect(dto.cumulativeFeesFen).toBe("2500");
    expect(typeof dto.availableCash).toBe("string");
    expect(typeof dto.frozenCash).toBe("string");
    expect(() => JSON.stringify(dto)).not.toThrow();
  });

  it("serializes unavailable snapshot", () => {
    const snap: PaperAccountSnapshot = {
      accountId: "acc-1", availableCashFen: BigInt("9000000"), frozenCashFen: BigInt("1000000"), positionMarketValueFen: null, totalAssetsFen: null, realizedPnlFen: BigInt("500000"), cumulativeFeesFen: BigInt("2500"), settingsVersion: 3, quoteStatus: "unavailable",
    };
    const dto = serializePaperAccountSnapshot(snap);
    expect(dto.positionMarketValueFen).toBeNull();
    expect(dto.totalAssetsFen).toBeNull();
    expect(dto.positionMarketValue).toBeNull();
    expect(dto.totalAssets).toBeNull();
  });
});