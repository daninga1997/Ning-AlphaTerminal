import type { CashLedgerDirection, CashLedgerType } from "@prisma/client";
import type { MoneyFen } from "@/lib/paper-account/paper-account-types";
import type { CashLedgerEntryRecord } from "./paper-account-repositories";
import type { PaperAccountUnitOfWork } from "./paper-account-unit-of-work";

// ── Public types ───────────────────────────────────────────────────────────

export type PaperAccountCashAdjustmentDirection = "credit" | "debit";

export type AdjustPaperAccountCashInput = {
  accountId: string;
  direction: PaperAccountCashAdjustmentDirection;
  amountFen: MoneyFen;
  reason: string;
  actorId: string;
  occurredAt: string;
  idempotencyKey: string;
  expectedAccountVersion: number;
};

export type CashAdjustmentResult = {
  ledgerEntryId: string;
  availableCashFen: MoneyFen;
  accountVersion: number;
  created: boolean;
};

export type PaperAccountCashAdjustmentService = {
  adjustPaperAccountCash(
    input: AdjustPaperAccountCashInput,
  ): Promise<CashAdjustmentResult>;
};

// ── Private constants ──────────────────────────────────────────────────────

const canonicalIsoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// ── Private metadata type ──────────────────────────────────────────────────

type CashAdjustmentMetadata = {
  reason: string;
  actorId: string;
  direction: PaperAccountCashAdjustmentDirection;
  amountFen: string;
  occurredAt: string;
  accountVersionBefore: number;
  accountVersionAfter: number;
};

// ── Private helpers ────────────────────────────────────────────────────────

function assertNonBlank(value: string, errorCode: string): void {
  if (value.trim().length === 0) {
    throw new Error(errorCode);
  }
}

function assertCanonicalIsoDateTime(value: string): void {
  if (!canonicalIsoDateTimePattern.test(value)) {
    throw new Error("PAPER_ACCOUNT_DATE_INVALID");
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error("PAPER_ACCOUNT_DATE_INVALID");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isCreditOrDebit(value: unknown): value is PaperAccountCashAdjustmentDirection {
  return value === "credit" || value === "debit";
}

function parseCashAdjustmentMetadata(
  ledger: CashLedgerEntryRecord,
): CashAdjustmentMetadata {
  if (ledger.metadataJson === null) {
    throw new Error("PAPER_ACCOUNT_CASH_ADJUSTMENT_METADATA_INVALID");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(ledger.metadataJson);
  } catch {
    throw new Error("PAPER_ACCOUNT_CASH_ADJUSTMENT_METADATA_INVALID");
  }

  if (!isRecord(parsed)) {
    throw new Error("PAPER_ACCOUNT_CASH_ADJUSTMENT_METADATA_INVALID");
  }

  const reason = parsed.reason;
  const actorId = parsed.actorId;
  const direction = parsed.direction;
  const amountFen = parsed.amountFen;
  const occurredAt = parsed.occurredAt;
  const accountVersionBefore = parsed.accountVersionBefore;
  const accountVersionAfter = parsed.accountVersionAfter;

  if (!isString(reason) || !isString(actorId) || !isString(amountFen) || !isString(occurredAt)) {
    throw new Error("PAPER_ACCOUNT_CASH_ADJUSTMENT_METADATA_INVALID");
  }

  if (!isCreditOrDebit(direction)) {
    throw new Error("PAPER_ACCOUNT_CASH_ADJUSTMENT_METADATA_INVALID");
  }

  if (
    typeof accountVersionAfter !== "number" ||
    !Number.isSafeInteger(accountVersionAfter) ||
    accountVersionAfter < 1
  ) {
    throw new Error("PAPER_ACCOUNT_CASH_ADJUSTMENT_METADATA_INVALID");
  }

  if (
    typeof accountVersionBefore !== "number" ||
    !Number.isSafeInteger(accountVersionBefore) ||
    accountVersionBefore < 1
  ) {
    throw new Error("PAPER_ACCOUNT_CASH_ADJUSTMENT_METADATA_INVALID");
  }

  return {
    reason,
    actorId,
    direction: direction as PaperAccountCashAdjustmentDirection,
    amountFen,
    occurredAt,
    accountVersionBefore,
    accountVersionAfter,
  };
}

function nextSequence(
  existingSequence: number | null,
  errorCode: string,
): number {
  if (existingSequence === null) {
    return 1;
  }
  if (!Number.isSafeInteger(existingSequence) || existingSequence < 1) {
    throw new Error(errorCode);
  }
  const next = existingSequence + 1;
  if (!Number.isSafeInteger(next)) {
    throw new Error(errorCode);
  }
  return next;
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createPaperAccountCashAdjustmentService(
  unitOfWork: PaperAccountUnitOfWork,
): PaperAccountCashAdjustmentService {
  return {
    async adjustPaperAccountCash(input) {
      // Input validation before transaction
      assertNonBlank(input.accountId, "PAPER_ACCOUNT_ACCOUNT_ID_REQUIRED");

      if (input.direction !== "credit" && input.direction !== "debit") {
        throw new Error("PAPER_ACCOUNT_ADJUSTMENT_DIRECTION_INVALID");
      }

      if (typeof input.amountFen !== "bigint" || input.amountFen <= BigInt("0")) {
        throw new Error("PAPER_ACCOUNT_ADJUSTMENT_AMOUNT_INVALID");
      }

      assertNonBlank(input.reason, "PAPER_ACCOUNT_ADJUSTMENT_REASON_REQUIRED");
      assertNonBlank(input.actorId, "PAPER_ACCOUNT_ACTOR_ID_REQUIRED");
      assertNonBlank(input.idempotencyKey, "PAPER_ACCOUNT_IDEMPOTENCY_KEY_REQUIRED");
      assertCanonicalIsoDateTime(input.occurredAt);

      if (!Number.isSafeInteger(input.expectedAccountVersion) || input.expectedAccountVersion < 1) {
        throw new Error("PAPER_ACCOUNT_ACCOUNT_VERSION_INVALID");
      }

      return unitOfWork.run(async (context) => {
        // Idempotency check
        const existingLedger = await context.ledger.findByIdempotencyKey(input.idempotencyKey);

        if (existingLedger !== null) {
          if (
            existingLedger.accountId !== input.accountId ||
            existingLedger.type !== ("cash_adjustment" as CashLedgerType)
          ) {
            throw new Error("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
          }

          const metadata = parseCashAdjustmentMetadata(existingLedger);

          if (
            metadata.direction !== input.direction ||
            metadata.amountFen !== input.amountFen.toString() ||
            metadata.reason !== input.reason ||
            metadata.actorId !== input.actorId ||
            metadata.occurredAt !== input.occurredAt
          ) {
            throw new Error("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
          }

          return {
            ledgerEntryId: existingLedger.id,
            availableCashFen: existingLedger.balanceAfterFen,
            accountVersion: metadata.accountVersionAfter,
            created: false,
          };
        }

        // Find account
        const account = await context.accounts.findById(input.accountId);
        if (account === null) {
          throw new Error("PAPER_ACCOUNT_ACCOUNT_NOT_FOUND");
        }

        // Version check
        if (account.accountVersion !== input.expectedAccountVersion) {
          throw new Error("ACCOUNT_VERSION_CONFLICT");
        }

        // Calculate new balance
        const balanceAfterFen =
          input.direction === "credit"
            ? account.availableCashFen + input.amountFen
            : account.availableCashFen - input.amountFen;

        if (balanceAfterFen < BigInt("0")) {
          throw new Error("PAPER_ACCOUNT_INSUFFICIENT_CASH");
        }

        // Compute sequence numbers
        const [ledgerEntries, auditEntries] = await Promise.all([
          context.ledger.listByAccount(input.accountId),
          context.audit.listByAccount(input.accountId),
        ]);

        const lastLedgerSeq = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].sequence : null;
        const lastAuditSeq = auditEntries.length > 0 ? auditEntries[auditEntries.length - 1].sequence : null;

        const nextLedgerSeq = nextSequence(lastLedgerSeq, "PAPER_ACCOUNT_LEDGER_SEQUENCE_INVALID");
        const nextAuditSeq = nextSequence(lastAuditSeq, "PAPER_ACCOUNT_AUDIT_SEQUENCE_INVALID");

        // Validate expected next account version
        const expectedNextAccountVersion = input.expectedAccountVersion + 1;
        if (!Number.isSafeInteger(expectedNextAccountVersion)) {
          throw new Error("PAPER_ACCOUNT_ACCOUNT_VERSION_INVALID");
        }

        // Update account cash
        const updatedAccount = await context.accounts.updateCash({
          accountId: account.id,
          availableCashFen: balanceAfterFen,
          frozenCashFen: account.frozenCashFen,
          expectedAccountVersion: input.expectedAccountVersion,
        });

        if (updatedAccount.accountVersion !== expectedNextAccountVersion) {
          throw new Error("PAPER_ACCOUNT_ACCOUNT_VERSION_INVALID");
        }

        // Append ledger entry
        const metadataJson = JSON.stringify({
          reason: input.reason,
          actorId: input.actorId,
          direction: input.direction,
          amountFen: input.amountFen.toString(),
          occurredAt: input.occurredAt,
          accountVersionBefore: input.expectedAccountVersion,
          accountVersionAfter: updatedAccount.accountVersion,
        });

        const ledgerEntry = await context.ledger.append({
          accountId: input.accountId,
          orderId: null,
          sequence: nextLedgerSeq,
          direction: (input.direction === "credit" ? "credit" : "debit") as CashLedgerDirection,
          type: "cash_adjustment" as CashLedgerType,
          amountFen: input.amountFen,
          balanceAfterFen,
          idempotencyKey: input.idempotencyKey,
          metadataJson,
          occurredAt: input.occurredAt,
        });

        // Append audit log
        const payloadJson = JSON.stringify({
          reason: input.reason,
          direction: input.direction,
          amountFen: input.amountFen.toString(),
          balanceBeforeFen: account.availableCashFen.toString(),
          balanceAfterFen: balanceAfterFen.toString(),
          accountVersionBefore: input.expectedAccountVersion,
          accountVersionAfter: updatedAccount.accountVersion,
          ledgerEntryId: ledgerEntry.id,
        });

        await context.audit.append({
          accountId: input.accountId,
          sequence: nextAuditSeq,
          action: "cash_adjusted",
          actorId: input.actorId,
          entityType: "CashLedgerEntry",
          entityId: ledgerEntry.id,
          payloadJson,
          idempotencyKey: `${input.idempotencyKey}:audit`,
          occurredAt: input.occurredAt,
        });

        return {
          ledgerEntryId: ledgerEntry.id,
          availableCashFen: updatedAccount.availableCashFen,
          accountVersion: updatedAccount.accountVersion,
          created: true,
        };
      });
    },
  };
}