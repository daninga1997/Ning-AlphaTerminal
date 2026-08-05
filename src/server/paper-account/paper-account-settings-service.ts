import type { BasisPoints, MoneyFen, RatePpm } from "@/lib/paper-account/paper-account-types";
import type { PaperAccountSettingsVersionRecord } from "./paper-account-repositories";
import type { PaperAccountUnitOfWork } from "./paper-account-unit-of-work";

// ── Public types ───────────────────────────────────────────────────────────

export type PaperAccountSettingsValuesInput = {
  commissionRatePpm: RatePpm;
  minimumCommissionFen: MoneyFen;
  stampDutySellRatePpm: RatePpm;
  transferFeeRatePpm: RatePpm;
  maxSingleStockBp: BasisPoints;
  maxTotalPositionBp: BasisPoints;
  maxRiskBp: BasisPoints;
};

export type UpdateNewAccountDefaultsInput = PaperAccountSettingsValuesInput & {
  initialCashForNewAccountsFen: MoneyFen;
  actorId: string;
  occurredAt: string;
  idempotencyKey: string;
};

export type CreateAccountSettingsVersionInput = PaperAccountSettingsValuesInput & {
  accountId: string;
  initialCashForNewAccountsFen?: MoneyFen | null;
  actorId: string;
  occurredAt: string;
  idempotencyKey: string;
};

export type PaperAccountSettingsService = {
  updateNewAccountDefaults(
    input: UpdateNewAccountDefaultsInput,
  ): Promise<PaperAccountSettingsVersionRecord>;
  createAccountSettingsVersion(
    input: CreateAccountSettingsVersionInput,
  ): Promise<PaperAccountSettingsVersionRecord>;
};

// ── Private constants ──────────────────────────────────────────────────────

const NEW_ACCOUNT_DEFAULT_SCOPE_KEY = "new-account-default";
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

function assertNonNegativeBigInt(value: unknown, errorCode: string): asserts value is MoneyFen {
  if (typeof value !== "bigint" || value < BigInt("0")) {
    throw new Error(errorCode);
  }
}

function assertRatePpm(value: unknown): void {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 1_000_000) {
    throw new Error("PAPER_ACCOUNT_RATE_INVALID");
  }
}

function assertBasisPoints(value: unknown): void {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 10_000) {
    throw new Error("PAPER_ACCOUNT_BASIS_POINTS_INVALID");
  }
}

function nextSettingsVersion(latestVersion: number | null): number {
  if (latestVersion === null) {
    return 1;
  }
  if (!Number.isSafeInteger(latestVersion) || latestVersion <= 0) {
    throw new Error("PAPER_ACCOUNT_SETTINGS_VERSION_INVALID");
  }
  const nextVersion = latestVersion + 1;
  if (!Number.isSafeInteger(nextVersion)) {
    throw new Error("PAPER_ACCOUNT_SETTINGS_VERSION_INVALID");
  }
  return nextVersion;
}

function validateSettingsValues(input: PaperAccountSettingsValuesInput & { minimumCommissionFen: MoneyFen; initialCashForNewAccountsFen?: MoneyFen | null }): void {
  assertNonNegativeBigInt(input.minimumCommissionFen, "PAPER_ACCOUNT_MINIMUM_COMMISSION_INVALID");
  assertRatePpm(input.commissionRatePpm);
  assertRatePpm(input.stampDutySellRatePpm);
  assertRatePpm(input.transferFeeRatePpm);
  assertBasisPoints(input.maxSingleStockBp);
  assertBasisPoints(input.maxTotalPositionBp);
  assertBasisPoints(input.maxRiskBp);
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createPaperAccountSettingsService(
  unitOfWork: PaperAccountUnitOfWork,
): PaperAccountSettingsService {
  return {
    async updateNewAccountDefaults(input) {
      assertNonBlank(input.actorId, "PAPER_ACCOUNT_ACTOR_ID_REQUIRED");
      assertNonBlank(input.idempotencyKey, "PAPER_ACCOUNT_IDEMPOTENCY_KEY_REQUIRED");
      assertCanonicalIsoDateTime(input.occurredAt);
      assertNonNegativeBigInt(input.initialCashForNewAccountsFen, "PAPER_ACCOUNT_DEFAULT_INITIAL_CASH_INVALID");
      validateSettingsValues(input);

      return unitOfWork.run(async (context) => {
        const existingByIdempotency = await context.settings.findByIdempotencyKey(input.idempotencyKey);

        if (existingByIdempotency !== null) {
          if (
            existingByIdempotency.scopeKey !== NEW_ACCOUNT_DEFAULT_SCOPE_KEY ||
            existingByIdempotency.accountId !== null
          ) {
            throw new Error("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
          }
          return existingByIdempotency;
        }

        const latest = await context.settings.findLatestByScope(NEW_ACCOUNT_DEFAULT_SCOPE_KEY);
        const version = nextSettingsVersion(latest?.version ?? null);

        return context.settings.append({
          scopeKey: NEW_ACCOUNT_DEFAULT_SCOPE_KEY,
          accountId: null,
          version,
          initialCashForNewAccountsFen: input.initialCashForNewAccountsFen,
          commissionRatePpm: input.commissionRatePpm,
          minimumCommissionFen: input.minimumCommissionFen,
          stampDutySellRatePpm: input.stampDutySellRatePpm,
          transferFeeRatePpm: input.transferFeeRatePpm,
          maxSingleStockBp: input.maxSingleStockBp,
          maxTotalPositionBp: input.maxTotalPositionBp,
          maxRiskBp: input.maxRiskBp,
          actorId: input.actorId,
          occurredAt: input.occurredAt,
          idempotencyKey: input.idempotencyKey,
        });
      });
    },

    async createAccountSettingsVersion(input) {
      if (
        Object.prototype.hasOwnProperty.call(input, "initialCashForNewAccountsFen")
      ) {
        throw new Error("INITIAL_CASH_IMMUTABLE");
      }

      assertNonBlank(input.accountId, "PAPER_ACCOUNT_ACCOUNT_ID_REQUIRED");
      assertNonBlank(input.actorId, "PAPER_ACCOUNT_ACTOR_ID_REQUIRED");
      assertNonBlank(input.idempotencyKey, "PAPER_ACCOUNT_IDEMPOTENCY_KEY_REQUIRED");
      assertCanonicalIsoDateTime(input.occurredAt);
      validateSettingsValues(input);

      return unitOfWork.run(async (context) => {
        const existingByIdempotency = await context.settings.findByIdempotencyKey(input.idempotencyKey);
        const scopeKey = `account:${input.accountId}`;

        if (existingByIdempotency !== null) {
          if (
            existingByIdempotency.accountId !== input.accountId ||
            existingByIdempotency.scopeKey !== scopeKey
          ) {
            throw new Error("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
          }
          return existingByIdempotency;
        }

        const account = await context.accounts.findById(input.accountId);
        if (account === null) {
          throw new Error("PAPER_ACCOUNT_ACCOUNT_NOT_FOUND");
        }

        const latest = await context.settings.findLatestByScope(scopeKey);
        if (latest === null) {
          throw new Error("PAPER_ACCOUNT_SETTINGS_NOT_FOUND");
        }

        const version = nextSettingsVersion(latest.version);

        return context.settings.append({
          scopeKey,
          accountId: input.accountId,
          version,
          initialCashForNewAccountsFen: null,
          commissionRatePpm: input.commissionRatePpm,
          minimumCommissionFen: input.minimumCommissionFen,
          stampDutySellRatePpm: input.stampDutySellRatePpm,
          transferFeeRatePpm: input.transferFeeRatePpm,
          maxSingleStockBp: input.maxSingleStockBp,
          maxTotalPositionBp: input.maxTotalPositionBp,
          maxRiskBp: input.maxRiskBp,
          actorId: input.actorId,
          occurredAt: input.occurredAt,
          idempotencyKey: input.idempotencyKey,
        });
      });
    },
  };
}