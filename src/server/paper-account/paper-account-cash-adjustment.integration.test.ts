import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPaperAccountInitializer } from "./paper-account-initializer";
import { createPaperAccountCashAdjustmentService } from "./paper-account-cash-adjustment-service";
import { createPaperAccountIntegrityService } from "./paper-account-integrity-service";
import { createPrismaPaperAccountUnitOfWork } from "./prisma-paper-account-unit-of-work";

const prisma = new PrismaClient();
const unitOfWork = createPrismaPaperAccountUnitOfWork(prisma);
const initializer = createPaperAccountInitializer(unitOfWork);
const adjustmentService = createPaperAccountCashAdjustmentService(unitOfWork);
const integrityService = createPaperAccountIntegrityService(unitOfWork);

let sequence = 0;

function uniqueKey(prefix: string): string {
  sequence += 1;
  return `review2-${prefix}-${sequence}`;
}

const occurredAt = "2026-08-04T02:00:00.000Z";
const laterAt = "2026-08-04T03:00:00.000Z";

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe.sequential("PaperAccountCashAdjustment integration", () => {
  it("keeps total ledger cash consistent when available cash is adjusted with frozen cash", async () => {
    // 1. Initialize account
    const initResult = await initializer.initializeDefaultPaperAccount({
      accountKey: uniqueKey("account"),
      actorId: "review-2-test",
      occurredAt,
      idempotencyKey: uniqueKey("init"),
    });

    expect(initResult.created).toBe(true);
    expect(typeof initResult.initialCashFen).toBe("bigint");

    const initialCashFen = initResult.initialCashFen;
    const frozenCashFen = BigInt("200000");
    const creditAmountFen = BigInt("1000000");

    // Initial cash must be large enough to freeze and later credit.
    expect(initialCashFen >= frozenCashFen).toBe(true);

    const availableCashAfterFreezeFen = initialCashFen - frozenCashFen;
    const availableCashAfterAdjustmentFen = availableCashAfterFreezeFen + creditAmountFen;
    const totalCashAfterAdjustmentFen = initialCashFen + creditAmountFen;

    const accountId = initResult.accountId;
    const account = await prisma.paperAccount.findUnique({ where: { id: accountId } });
    expect(account!.availableCashFen).toBe(initialCashFen);
    expect(account!.frozenCashFen).toBe(BigInt("0"));
    expect(account!.accountVersion).toBe(1);

    // 2. Simulate frozen cash via updateCash
    const afterFreeze = await unitOfWork.run((context) =>
      context.accounts.updateCash({
        accountId,
        availableCashFen: availableCashAfterFreezeFen,
        frozenCashFen,
        expectedAccountVersion: 1,
      }),
    );
    expect(afterFreeze.availableCashFen).toBe(availableCashAfterFreezeFen);
    expect(afterFreeze.frozenCashFen).toBe(frozenCashFen);
    expect(afterFreeze.accountVersion).toBe(2);

    // 3. Perform credit adjustment
    const adjIdempotencyKey = uniqueKey("adj");
    const adjResult = await adjustmentService.adjustPaperAccountCash({
      accountId,
      direction: "credit",
      amountFen: creditAmountFen,
      reason: "review-2-credit",
      actorId: "review-2-test",
      occurredAt: laterAt,
      idempotencyKey: adjIdempotencyKey,
      expectedAccountVersion: 2,
    });

    expect(adjResult.created).toBe(true);
    expect(adjResult.availableCashFen).toBe(availableCashAfterAdjustmentFen);
    expect(adjResult.accountVersion).toBe(3);

    // 4. Verify account cache
    const acct = await prisma.paperAccount.findUnique({ where: { id: accountId } });
    expect(acct!.availableCashFen).toBe(availableCashAfterAdjustmentFen);
    expect(acct!.frozenCashFen).toBe(frozenCashFen);

    // 5. Verify cash ledger
    const entries = await prisma.cashLedgerEntry.findMany({
      where: { accountId },
      orderBy: { sequence: "asc" },
    });
    expect(entries.length).toBe(2);
    expect(entries[0].type).toBe("initial_cash");
    expect(entries[0].amountFen).toBe(initialCashFen);
    expect(entries[0].balanceAfterFen).toBe(initialCashFen);

    const adjEntry = entries[1];
    expect(adjEntry.type).toBe("cash_adjustment");
    expect(adjEntry.amountFen).toBe(creditAmountFen);
    expect(adjEntry.balanceAfterFen).toBe(totalCashAfterAdjustmentFen);

    const meta = JSON.parse(adjEntry.metadataJson!);
    expect(meta.availableCashAfterFen).toBe(availableCashAfterAdjustmentFen.toString());

    // 6. Verify integrity
    const integrity = await integrityService.checkPaperAccountIntegrity(accountId);
    expect(integrity.valid).toBe(true);
    expect(integrity.issues).toEqual([]);
    expect(integrity.ledgerCashFen).toBe(totalCashAfterAdjustmentFen);
    expect(integrity.cachedCashFen).toBe(totalCashAfterAdjustmentFen);

    // 7. Verify idempotent replay
    const replay = await adjustmentService.adjustPaperAccountCash({
      accountId,
      direction: "credit",
      amountFen: creditAmountFen,
      reason: "review-2-credit",
      actorId: "review-2-test",
      occurredAt: laterAt,
      idempotencyKey: adjIdempotencyKey,
      expectedAccountVersion: 2,
    });

    expect(replay.created).toBe(false);
    expect(replay.ledgerEntryId).toBe(adjResult.ledgerEntryId);
    expect(replay.availableCashFen).toBe(availableCashAfterAdjustmentFen);
    expect(replay.accountVersion).toBe(3);

    // Verify no duplicate entries
    const entriesAfter = await prisma.cashLedgerEntry.findMany({
      where: { accountId },
    });
    expect(entriesAfter.length).toBe(2);
    expect(await prisma.paperAuditLog.count({ where: { accountId } })).toBe(2);
    const acctAfter = await prisma.paperAccount.findUnique({ where: { id: accountId } });
    expect(acctAfter!.accountVersion).toBe(3);
    expect(acctAfter!.availableCashFen).toBe(availableCashAfterAdjustmentFen);
    expect(acctAfter!.frozenCashFen).toBe(frozenCashFen);
  });
});