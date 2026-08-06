import type { CashLedgerDirection, CashLedgerType, PaperAccountStatus } from "@prisma/client";
import type { MoneyFen } from "@/lib/paper-account/paper-account-types";
import type { PaperAccountSettingsVersionRecord } from "./paper-account-repositories";
import type { PaperAccountUnitOfWork } from "./paper-account-unit-of-work";

// ── Public types ───────────────────────────────────────────────────────────

export type InitializeDefaultPaperAccountInput = {
  accountKey: string;
  actorId: string;
  occurredAt: string;
  idempotencyKey: string;
};

export type InitializeDefaultPaperAccountResult = {
  accountId: string;
  created: boolean;
  initialCashFen: MoneyFen;
  settingsVersion: number;
};

export type PaperAccountInitializer = {
  initializeDefaultPaperAccount(
    input: InitializeDefaultPaperAccountInput,
  ): Promise<InitializeDefaultPaperAccountResult>;
};

// ── Private constants ──────────────────────────────────────────────────────

const NEW_ACCOUNT_DEFAULT_SCOPE_KEY = "new-account-default";
const NEW_ACCOUNT_DEFAULT_IDEMPOTENCY_KEY = "paper-account:new-account-default:v1";
const DEFAULT_INITIAL_CASH_FEN = BigInt("10000000");
const DEFAULT_MINIMUM_COMMISSION_FEN = BigInt("500");

const canonicalIsoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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

function assertValidDefaultSettings(
  settings: PaperAccountSettingsVersionRecord,
): asserts settings is PaperAccountSettingsVersionRecord & {
  initialCashForNewAccountsFen: MoneyFen;
} {
  if (
    settings.scopeKey !== NEW_ACCOUNT_DEFAULT_SCOPE_KEY ||
    settings.accountId !== null ||
    settings.initialCashForNewAccountsFen === null
  ) {
    throw new Error("PAPER_ACCOUNT_DEFAULT_SETTINGS_INVALID");
  }

  if (
    typeof settings.initialCashForNewAccountsFen !== "bigint" ||
    settings.initialCashForNewAccountsFen < BigInt("0")
  ) {
    throw new Error("PAPER_ACCOUNT_DEFAULT_INITIAL_CASH_INVALID");
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createPaperAccountInitializer(
  unitOfWork: PaperAccountUnitOfWork,
): PaperAccountInitializer {
  return {
    async initializeDefaultPaperAccount(input) {
      // Input validation before any transaction
      assertNonBlank(input.accountKey, "PAPER_ACCOUNT_ACCOUNT_KEY_REQUIRED");
      assertNonBlank(input.actorId, "PAPER_ACCOUNT_ACTOR_ID_REQUIRED");
      assertNonBlank(input.idempotencyKey, "PAPER_ACCOUNT_IDEMPOTENCY_KEY_REQUIRED");
      assertCanonicalIsoDateTime(input.occurredAt);

      return unitOfWork.run(async (context) => {
        // Check for existing account
        const existingAccount = await context.accounts.findByKey(input.accountKey);

        if (existingAccount !== null) {
          const existingSettings = await context.settings.findLatestByScope(
            `account:${existingAccount.id}`,
          );

          if (existingSettings === null) {
            throw new Error("PAPER_ACCOUNT_INITIALIZATION_INCOMPLETE");
          }

          return {
            accountId: existingAccount.id,
            created: false,
            initialCashFen: existingAccount.initialCashFen,
            settingsVersion: existingSettings.version,
          };
        }

        // Read or create default template
        let defaultSettings = await context.settings.findLatestByScope(
          NEW_ACCOUNT_DEFAULT_SCOPE_KEY,
        );

        if (defaultSettings === null) {
          defaultSettings = await context.settings.append({
            scopeKey: NEW_ACCOUNT_DEFAULT_SCOPE_KEY,
            accountId: null,
            version: 1,
            initialCashForNewAccountsFen: DEFAULT_INITIAL_CASH_FEN,
            commissionRatePpm: 250,
            minimumCommissionFen: DEFAULT_MINIMUM_COMMISSION_FEN,
            stampDutySellRatePpm: 500,
            transferFeeRatePpm: 10,
            maxSingleStockBp: 3000,
            maxTotalPositionBp: 8000,
            maxRiskBp: 200,
            actorId: input.actorId,
            occurredAt: input.occurredAt,
            idempotencyKey: NEW_ACCOUNT_DEFAULT_IDEMPOTENCY_KEY,
          });
        }

        assertValidDefaultSettings(defaultSettings);

        const initialCashFen = defaultSettings.initialCashForNewAccountsFen;

        // Create account
        const account = await context.accounts.create({
          accountKey: input.accountKey,
          initialCashFen,
          status: "active" as PaperAccountStatus,
        });

        // Create account settings version 1
        const accountSettings = await context.settings.append({
          scopeKey: `account:${account.id}`,
          accountId: account.id,
          version: 1,
          initialCashForNewAccountsFen: null,
          commissionRatePpm: defaultSettings.commissionRatePpm,
          minimumCommissionFen: defaultSettings.minimumCommissionFen,
          stampDutySellRatePpm: defaultSettings.stampDutySellRatePpm,
          transferFeeRatePpm: defaultSettings.transferFeeRatePpm,
          maxSingleStockBp: defaultSettings.maxSingleStockBp,
          maxTotalPositionBp: defaultSettings.maxTotalPositionBp,
          maxRiskBp: defaultSettings.maxRiskBp,
          actorId: input.actorId,
          occurredAt: input.occurredAt,
          idempotencyKey: `${input.idempotencyKey}:account-settings:v1`,
        });

        // Append initial cash ledger entry
        const metadataJson = JSON.stringify({
          reason: "initial_account_funding",
          actorId: input.actorId,
          defaultSettingsVersion: defaultSettings.version,
          accountSettingsVersion: accountSettings.version,
        });

        await context.ledger.append({
          accountId: account.id,
          orderId: null,
          sequence: 1,
          direction: "credit" as CashLedgerDirection,
          type: "initial_cash" as CashLedgerType,
          amountFen: initialCashFen,
          balanceAfterFen: initialCashFen,
          idempotencyKey: `${input.idempotencyKey}:initial-cash`,
          metadataJson,
          occurredAt: input.occurredAt,
        });

        // Append audit log
        const payloadJson = JSON.stringify({
          accountKey: input.accountKey,
          initialCashFen: initialCashFen.toString(),
          defaultSettingsVersion: defaultSettings.version,
          accountSettingsVersion: accountSettings.version,
        });

        await context.audit.append({
          accountId: account.id,
          sequence: 1,
          action: "account_initialized",
          actorId: input.actorId,
          entityType: "PaperAccount",
          entityId: account.id,
          payloadJson,
          idempotencyKey: `${input.idempotencyKey}:account-initialized`,
          occurredAt: input.occurredAt,
        });

        return {
          accountId: account.id,
          created: true,
          initialCashFen: account.initialCashFen,
          settingsVersion: accountSettings.version,
        };
      });
    },
  };
}