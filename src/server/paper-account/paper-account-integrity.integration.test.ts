import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PaperAccountQuoteReader } from "./paper-account-quote-port";
import { createPaperAccountSnapshotService } from "./paper-account-snapshot-service";
import { createPaperAccountIntegrityService } from "./paper-account-integrity-service";
import { createPrismaPaperAccountUnitOfWork } from "./prisma-paper-account-unit-of-work";

const prisma = new PrismaClient();
const unitOfWork = createPrismaPaperAccountUnitOfWork(prisma);
const snapshotService = createPaperAccountSnapshotService(unitOfWork);
const integrityService = createPaperAccountIntegrityService(unitOfWork);

let sequence = 0;

function uniqueKey(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

const occurredAt = "2026-08-05T02:00:00.000Z";
const task9SettingsActorPrefix = `task9-integrity-${Date.now()}`;

function task9Actor(label: string): string {
  sequence += 1;
  return `${task9SettingsActorPrefix}:${label}:${sequence}`;
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createFixtureAccount(includeSettings = true): Promise<string> {
  const accountKey = uniqueKey("fixture");
  let accountId = "";

  await unitOfWork.run(async (context) => {
    const account = await context.accounts.create({
      accountKey,
      initialCashFen: BigInt("10000000"),
      status: "active",
    });
    if (includeSettings) {
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
        actorId: task9Actor("fixture"),
        occurredAt,
        idempotencyKey: uniqueKey("init-settings"),
      });
    }
    accountId = account.id;
  });

  return accountId;
}

const throwingQuoteReader: PaperAccountQuoteReader = {
  async getLatestQuotes() {
    throw new Error("QUOTE_NOT_EXPECTED");
  },
};

describe.sequential("PaperAccountIntegrity integration", () => {
  // 1 ── No-position snapshot ──────────────────────────────────────────

  it("returns fresh snapshot when no positions", async () => {
    const accountId = await createFixtureAccount();

    const result = await snapshotService.getPaperAccountSnapshot({
      accountId,
      quoteReader: throwingQuoteReader,
    });

    expect(result.positionMarketValueFen).toBe(BigInt("0"));
    expect(result.totalAssetsFen).toBe(BigInt("10000000"));
    expect(result.quoteStatus).toBe("fresh");
    expect(result.settingsVersion).toBe(1);

    // verify snapshot is serializable
    const { serializePaperAccountSnapshot } = await import("./paper-account-snapshot-service");
    const dto = serializePaperAccountSnapshot(result);
    expect(() => JSON.stringify(dto)).not.toThrow();
  });

  // 2 ── Fresh quote snapshot ──────────────────────────────────────────

  it("computes market value with fresh quotes", async () => {
    const accountId = await createFixtureAccount();

    // Create positions via UnitOfWork
    await unitOfWork.run(async (context) => {
      await context.positions.create({
        accountId,
        code: "000001",
        totalQuantity: 100,
        sellableQuantity: 100,
        frozenQuantity: 0,
        averageCostFen: BigInt("1000"),
        realizedPnlFen: BigInt("0"),
      });
      await context.positions.create({
        accountId,
        code: "000002",
        totalQuantity: 250,
        sellableQuantity: 250,
        frozenQuantity: 0,
        averageCostFen: BigInt("500"),
        realizedPnlFen: BigInt("0"),
      });
    });

    const freshQuoteReader: PaperAccountQuoteReader = {
      async getLatestQuotes() {
        return new Map([
          ["000001", { priceFen: BigInt("1234"), status: "fresh", observedAt: "2026-08-05T01:00:00.000Z" }],
          ["000002", { priceFen: BigInt("567"), status: "fresh", observedAt: "2026-08-05T01:00:00.000Z" }],
        ]);
      },
    };

    const result = await snapshotService.getPaperAccountSnapshot({
      accountId,
      quoteReader: freshQuoteReader,
    });

    expect(result.positionMarketValueFen).toBe(BigInt("100") * BigInt("1234") + BigInt("250") * BigInt("567"));
    expect(result.totalAssetsFen).toBe(BigInt("10000000") + BigInt("100") * BigInt("1234") + BigInt("250") * BigInt("567"));
    expect(result.quoteStatus).toBe("fresh");
  });

  // 3 ── Missing quote → unavailable ───────────────────────────────────

  it("returns unavailable when quote missing", async () => {
    const accountId = await createFixtureAccount();
    await unitOfWork.run(async (context) => {
      await context.positions.create({
        accountId, code: "000001", totalQuantity: 100, sellableQuantity: 100, frozenQuantity: 0, averageCostFen: BigInt("1000"), realizedPnlFen: BigInt("0"),
      });
      await context.positions.create({
        accountId, code: "000002", totalQuantity: 50, sellableQuantity: 50, frozenQuantity: 0, averageCostFen: BigInt("500"), realizedPnlFen: BigInt("0"),
      });
    });

    const partialReader: PaperAccountQuoteReader = {
      async getLatestQuotes() {
        return new Map([["000001", { priceFen: BigInt("1000"), status: "fresh", observedAt: "2026-08-05T01:00:00.000Z" }]]);
      },
    };

    const result = await snapshotService.getPaperAccountSnapshot({
      accountId, quoteReader: partialReader,
    });

    expect(result.positionMarketValueFen).toBeNull();
    expect(result.totalAssetsFen).toBeNull();
    expect(result.quoteStatus).toBe("unavailable");
  });

  // 4 ── Full integrity pass ───────────────────────────────────────────

  it("returns valid for consistent account", async () => {
    const accountId = await createFixtureAccount();

    await unitOfWork.run(async (context) => {
      // Add a position
      const position = await context.positions.create({
        accountId, code: "000001", totalQuantity: 100, sellableQuantity: 100, frozenQuantity: 0, averageCostFen: BigInt("1000"), realizedPnlFen: BigInt("0"),
      });
      // Add lots
      await context.lots.append({
        positionId: position.id, acquiredSequence: 1, acquiredTradingDate: "2026-08-04", sellableTradingDate: "2026-08-05", originalQuantity: 100, remainingQuantity: 100, priceFen: BigInt("1000"), buyFeeFen: BigInt("2500"),
      });
      // Add ledger entry
      await context.ledger.append({
        accountId, orderId: null, sequence: 1, direction: "credit", type: "initial_cash", amountFen: BigInt("10000000"), balanceAfterFen: BigInt("10000000"), idempotencyKey: uniqueKey("ledger"), metadataJson: "{}", occurredAt,
      });
      // Add fill (with fees totaling 2500)
      const order = await context.orders.append({
        accountId, positionId: position.id, code: "000001", side: "buy", quantity: 100, priceFen: BigInt("1000"), status: "filled", riskSnapshotJson: "{}", settingsVersion: 1, idempotencyKey: uniqueKey("order"), confirmedAt: null, completedAt: null,
      });
      await context.fills.append({
        orderId: order.id, sequence: 1, quantity: 100, priceFen: BigInt("1000"), notionalFen: BigInt("100000"), commissionFen: BigInt("500"), stampDutyFen: BigInt("500"), transferFeeFen: BigInt("1500"), tradingDate: "2026-08-04", executedAt: occurredAt,
      });
      // Update cumulative fees to match, keep available+frozen = ledger
      await context.accounts.updateCash({
        accountId, availableCashFen: BigInt("9997500"), frozenCashFen: BigInt("2500"), realizedPnlFen: BigInt("0"), cumulativeFeesFen: BigInt("2500"), expectedAccountVersion: 1,
      });
    });

    const result = await integrityService.checkPaperAccountIntegrity(accountId);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.ledgerCashFen).toBe(BigInt("10000000"));
    expect(result.cachedCashFen).toBe(BigInt("10000000"));
  });

  // 5 ── Detects multi-category issues without repair ───────────────────

  it("detects issues without modifying data", async () => {
    const accountId = await createFixtureAccount(false); // No settings

    await unitOfWork.run(async (context) => {
      // Add ledger with wrong balance
      await context.ledger.append({
        accountId, orderId: null, sequence: 1, direction: "credit", type: "initial_cash", amountFen: BigInt("10000000"), balanceAfterFen: BigInt("5000000"), idempotencyKey: uniqueKey("bad-ledger"), metadataJson: "{}", occurredAt,
      });
      // Add fill with fees
      const order = await context.orders.append({
        accountId, positionId: null, code: "000001", side: "buy", quantity: 100, priceFen: BigInt("1000"), status: "filled", riskSnapshotJson: "{}", settingsVersion: 1, idempotencyKey: uniqueKey("bad-order"), confirmedAt: null, completedAt: null,
      });
      await context.fills.append({
        orderId: order.id, sequence: 1, quantity: 100, priceFen: BigInt("1000"), notionalFen: BigInt("100000"), commissionFen: BigInt("500"), stampDutyFen: BigInt("500"), transferFeeFen: BigInt("1500"), tradingDate: "2026-08-04", executedAt: occurredAt,
      });
      // Add position with lot mismatch
      const position = await context.positions.create({
        accountId, code: "000001", totalQuantity: 200, sellableQuantity: 200, frozenQuantity: 0, averageCostFen: BigInt("1000"), realizedPnlFen: BigInt("0"),
      });
      await context.lots.append({
        positionId: position.id, acquiredSequence: 1, acquiredTradingDate: "2026-08-04", sellableTradingDate: "2026-08-05", originalQuantity: 100, remainingQuantity: 100, priceFen: BigInt("1000"), buyFeeFen: BigInt("2500"),
      });
    });

    // Record pre-state
    const accountBefore = await prisma.paperAccount.findUnique({ where: { id: accountId } });
    const ledgersBefore = await prisma.cashLedgerEntry.findMany({ where: { accountId } });
    const fillsBefore = await prisma.paperFill.findMany({
      where: { orderId: { in: (await prisma.paperOrder.findMany({ where: { accountId }, select: { id: true } })).map((o) => o.id) } },
    });
    const positionsBefore = await prisma.paperPosition.findMany({ where: { accountId } });
    const lotsBefore = await prisma.paperLot.findMany({
      where: { positionId: { in: positionsBefore.map((p) => p.id) } },
    });

    const result = await integrityService.checkPaperAccountIntegrity(accountId);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain("PAPER_ACCOUNT_SETTINGS_MISSING");
    expect(result.issues).toContain("PAPER_ACCOUNT_LEDGER_BALANCE_MISMATCH");
    expect(result.issues).toContain("CUMULATIVE_FEES_MISMATCH");
    expect(result.issues).toContain("POSITION_LOT_QUANTITY_MISMATCH:000001");

    // Verify nothing was modified
    const accountAfter = await prisma.paperAccount.findUnique({ where: { id: accountId } });
    expect(accountAfter!.availableCashFen).toBe(accountBefore!.availableCashFen);
    expect(accountAfter!.cumulativeFeesFen).toBe(accountBefore!.cumulativeFeesFen);
    expect(await prisma.cashLedgerEntry.count({ where: { accountId } })).toBe(ledgersBefore.length);
    expect(await prisma.paperFill.count({
      where: { orderId: { in: (await prisma.paperOrder.findMany({ where: { accountId }, select: { id: true } })).map((o) => o.id) } },
    })).toBe(fillsBefore.length);
    expect(await prisma.paperPosition.count({ where: { accountId } })).toBe(positionsBefore.length);
    expect(await prisma.paperLot.count({
      where: { positionId: { in: positionsBefore.map((p) => p.id) } },
    })).toBe(lotsBefore.length);
    expect(await prisma.paperAuditLog.count({ where: { accountId } })).toBe(0);
  });

  // 6 ── Ledger sequence and amount anomalies ──────────────────────────

  it("detects ledger sequence and amount anomalies", async () => {
    const accountId = await createFixtureAccount();

    // Insert ledger entry with wrong sequence (should start at 1, we create sequence 5)
    // Raw SQL bypasses the Repository's sequence calculation
    await prisma.$executeRawUnsafe(
      `INSERT INTO CashLedgerEntry (id, accountId, sequence, direction, type, amountFen, balanceAfterFen, idempotencyKey, metadataJson, occurredAt, createdAt) VALUES (?, ?, 5, 'credit', 'initial_cash', 10000000, 10000000, ?, ?, ?, ?)`,
      uniqueKey("raw-ledger"), accountId, uniqueKey("raw-ledger-idem"), "{}", new Date(occurredAt), new Date(),
    );

    const result = await integrityService.checkPaperAccountIntegrity(accountId);
    expect(result.issues).toContain("PAPER_ACCOUNT_LEDGER_SEQUENCE_INVALID");
  });

  // 7 ── Read-only verification ────────────────────────────────────────

  it("does not modify any data on read", async () => {
    const accountId = await createFixtureAccount();

    await unitOfWork.run(async (context) => {
      await context.ledger.append({
        accountId, orderId: null, sequence: 1, direction: "credit", type: "initial_cash", amountFen: BigInt("10000000"), balanceAfterFen: BigInt("10000000"), idempotencyKey: uniqueKey("readonly-ledger"), metadataJson: "{}", occurredAt,
      });
    });

    const accountBefore = await prisma.paperAccount.findUnique({ where: { id: accountId } });
    const settingsBefore = await prisma.paperAccountSettingsVersion.findMany({ where: { accountId } });
    const ledgersBefore = await prisma.cashLedgerEntry.findMany({ where: { accountId } });
    const auditsBefore = await prisma.paperAuditLog.findMany({ where: { accountId } });

    await snapshotService.getPaperAccountSnapshot({ accountId, quoteReader: throwingQuoteReader });
    await integrityService.checkPaperAccountIntegrity(accountId);

    const accountAfter = await prisma.paperAccount.findUnique({ where: { id: accountId } });
    const settingsAfter = await prisma.paperAccountSettingsVersion.findMany({ where: { accountId } });
    const ledgersAfter = await prisma.cashLedgerEntry.findMany({ where: { accountId } });
    const auditsAfter = await prisma.paperAuditLog.findMany({ where: { accountId } });

    expect(accountAfter!.availableCashFen).toBe(accountBefore!.availableCashFen);
    expect(settingsAfter.length).toBe(settingsBefore.length);
    expect(ledgersAfter.length).toBe(ledgersBefore.length);
    expect(auditsAfter.length).toBe(auditsBefore.length);
  });

  // Ownership protection
  it("does not create new-account-default settings", async () => {
    const task9Owned = await prisma.paperAccountSettingsVersion.findMany({
      where: { actorId: { startsWith: task9SettingsActorPrefix } },
      select: { id: true, scopeKey: true, accountId: true, actorId: true, version: true },
      orderBy: [{ scopeKey: "asc" }, { version: "asc" }],
    });

    expect(task9Owned.length).toBeGreaterThan(0);
    expect(task9Owned.every((s) => s.accountId !== null)).toBe(true);
    expect(task9Owned.every((s) => s.scopeKey === `account:${s.accountId}`)).toBe(true);
    expect(task9Owned.filter((s) => s.scopeKey === "new-account-default")).toHaveLength(0);
  });
});