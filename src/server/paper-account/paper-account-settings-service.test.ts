import { describe, expect, it, vi } from "vitest";
import type {
  PaperAccountTransactionContext,
  PaperAccountUnitOfWork,
} from "./paper-account-unit-of-work";
import type {
  PaperAccountRecord,
  PaperAccountSettingsVersionInput,
  PaperAccountSettingsVersionRecord,
} from "./paper-account-repositories";
import type {
  CreateAccountSettingsVersionInput,
  UpdateNewAccountDefaultsInput,
} from "./paper-account-settings-service";
import { createPaperAccountSettingsService } from "./paper-account-settings-service";

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
    accounts: {
      findById: unexpectedRepositoryCall,
      findByKey: unexpectedRepositoryCall,
      create: unexpectedRepositoryCall,
      updateCash: unexpectedRepositoryCall,
    },
    settings: {
      findLatestByScope: unexpectedRepositoryCall,
      listByScope: unexpectedRepositoryCall,
      findByIdempotencyKey: unexpectedRepositoryCall,
      append: unexpectedRepositoryCall,
    },
    positions: {
      findByAccountAndCode: unexpectedRepositoryCall,
      listByAccount: unexpectedRepositoryCall,
      create: unexpectedRepositoryCall,
      updateWithVersion: unexpectedRepositoryCall,
    },
    lots: {
      listByPosition: unexpectedRepositoryCall,
      listSellableByPosition: unexpectedRepositoryCall,
      append: unexpectedRepositoryCall,
      updateRemainingQuantity: unexpectedRepositoryCall,
    },
    orders: {
      findById: unexpectedRepositoryCall,
      findByIdempotencyKey: unexpectedRepositoryCall,
      listByAccount: unexpectedRepositoryCall,
      append: unexpectedRepositoryCall,
      updateStatusWithVersion: unexpectedRepositoryCall,
    },
    fills: {
      findByOrderAndSequence: unexpectedRepositoryCall,
      listByOrder: unexpectedRepositoryCall,
      listByAccount: unexpectedRepositoryCall,
      append: unexpectedRepositoryCall,
    },
    ledger: {
      findByIdempotencyKey: unexpectedRepositoryCall,
      listByAccount: unexpectedRepositoryCall,
      sumByAccount: unexpectedRepositoryCall,
      append: unexpectedRepositoryCall,
    },
    exitRules: {
      findActiveByPosition: unexpectedRepositoryCall,
      listByPosition: unexpectedRepositoryCall,
      append: unexpectedRepositoryCall,
      supersede: unexpectedRepositoryCall,
    },
    audit: {
      findByIdempotencyKey: unexpectedRepositoryCall,
      listByAccount: unexpectedRepositoryCall,
      append: unexpectedRepositoryCall,
    },
    workerStates: {
      findByAccountAndCode: unexpectedRepositoryCall,
      listByAccount: unexpectedRepositoryCall,
      upsertWithVersion: unexpectedRepositoryCall,
    },
    leases: {
      findByKey: unexpectedRepositoryCall,
      acquire: unexpectedRepositoryCall,
      heartbeat: unexpectedRepositoryCall,
      release: unexpectedRepositoryCall,
    },
    ...overrides,
  } satisfies PaperAccountTransactionContext;
}

function defaultSettingsRecord(
  overrides: Partial<PaperAccountSettingsVersionRecord> = {},
): PaperAccountSettingsVersionRecord {
  return {
    id: "settings-1",
    scopeKey: "new-account-default",
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
    actorId: "operator",
    idempotencyKey: "settings-key",
    createdAt: "2026-08-04T00:00:00.000Z",
    ...overrides,
  };
}

function accountRecord(overrides: Partial<PaperAccountRecord> = {}): PaperAccountRecord {
  return {
    id: "account-1",
    accountKey: "paper-account-1",
    initialCashFen: BigInt("10000000"),
    availableCashFen: BigInt("10000000"),
    frozenCashFen: BigInt("0"),
    realizedPnlFen: BigInt("0"),
    cumulativeFeesFen: BigInt("0"),
    accountVersion: 1,
    status: "active",
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
    ...overrides,
  };
}

const validDefaultsInput = {
  initialCashForNewAccountsFen: BigInt("20000000"),
  commissionRatePpm: 300,
  minimumCommissionFen: BigInt("600"),
  stampDutySellRatePpm: 550,
  transferFeeRatePpm: 12,
  maxSingleStockBp: 2500,
  maxTotalPositionBp: 7000,
  maxRiskBp: 150,
} as const;

function validUpdateDefaults(
  overrides: Partial<UpdateNewAccountDefaultsInput> = {},
): UpdateNewAccountDefaultsInput {
  return {
    ...validDefaultsInput,
    actorId: "operator",
    occurredAt: "2026-08-04T02:00:00.000Z",
    idempotencyKey: "defaults-update-1",
    ...overrides,
  };
}

function validCreateAccountSettings(
  overrides: Partial<CreateAccountSettingsVersionInput> = {},
): CreateAccountSettingsVersionInput {
  return {
    commissionRatePpm: 300,
    minimumCommissionFen: BigInt("600"),
    stampDutySellRatePpm: 550,
    transferFeeRatePpm: 12,
    maxSingleStockBp: 2500,
    maxTotalPositionBp: 7000,
    maxRiskBp: 150,
    accountId: "account-1",
    actorId: "operator",
    occurredAt: "2026-08-04T02:00:00.000Z",
    idempotencyKey: "account-settings-v2",
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PaperAccountSettingsService (unit)", () => {
  describe("updateNewAccountDefaults", () => {
    // 1 ── Basic input validation ─────────────────────────────────────────

    it("rejects blank actorId", async () => {
      const context = fullFakeContext();
      let runCount = 0;
      const uow = createFakeUnitOfWork(context, () => { runCount += 1; });
      const svc = createPaperAccountSettingsService(uow);

      await expect(
        svc.updateNewAccountDefaults(validUpdateDefaults({ actorId: "   " })),
      ).rejects.toThrow("PAPER_ACCOUNT_ACTOR_ID_REQUIRED");
      expect(runCount).toBe(0);
    });

    it("rejects blank idempotencyKey", async () => {
      const context = fullFakeContext();
      let runCount = 0;
      const uow = createFakeUnitOfWork(context, () => { runCount += 1; });
      const svc = createPaperAccountSettingsService(uow);

      await expect(
        svc.updateNewAccountDefaults(validUpdateDefaults({ idempotencyKey: "   " })),
      ).rejects.toThrow("PAPER_ACCOUNT_IDEMPOTENCY_KEY_REQUIRED");
      expect(runCount).toBe(0);
    });

    const invalidDates = [
      "not-a-date",
      "2026-08-04",
      "2026-08-04T00:00:00Z",
      "2026-08-04T08:00:00.000+08:00",
      "+010000-01-01T00:00:00.000Z",
      "2026-02-30T00:00:00.000Z",
    ];

    it.each(invalidDates)("rejects non-canonical date %s", async (dateVal: string) => {
      const context = fullFakeContext();
      let runCount = 0;
      const uow = createFakeUnitOfWork(context, () => { runCount += 1; });
      const svc = createPaperAccountSettingsService(uow);

      await expect(
        svc.updateNewAccountDefaults(validUpdateDefaults({ occurredAt: dateVal })),
      ).rejects.toThrow("PAPER_ACCOUNT_DATE_INVALID");
      expect(runCount).toBe(0);
    });

    // 2 ── Settings value validation ──────────────────────────────────────

    it("rejects negative initialCashForNewAccountsFen", async () => {
      const context = fullFakeContext();
      let runCount = 0;
      const uow = createFakeUnitOfWork(context, () => { runCount += 1; });
      const svc = createPaperAccountSettingsService(uow);

      await expect(
        svc.updateNewAccountDefaults(validUpdateDefaults({
          initialCashForNewAccountsFen: BigInt("-1"),
        })),
      ).rejects.toThrow("PAPER_ACCOUNT_DEFAULT_INITIAL_CASH_INVALID");
      expect(runCount).toBe(0);
    });

    it("rejects negative minimumCommissionFen", async () => {
      const context = fullFakeContext();
      let runCount = 0;
      const uow = createFakeUnitOfWork(context, () => { runCount += 1; });
      const svc = createPaperAccountSettingsService(uow);

      await expect(
        svc.updateNewAccountDefaults(validUpdateDefaults({
          minimumCommissionFen: BigInt("-1"),
        })),
      ).rejects.toThrow("PAPER_ACCOUNT_MINIMUM_COMMISSION_INVALID");
      expect(runCount).toBe(0);
    });

    describe("ppm validation", () => {
      const ppmFields = ["commissionRatePpm", "stampDutySellRatePpm", "transferFeeRatePpm"] as const;

      for (const field of ppmFields) {
        const invalidPpm = [-1, 1_000_001, 1.5, Number.MAX_SAFE_INTEGER + 1] as const;
        it.each(invalidPpm)(`rejects ${field} = %s`, async (value: number) => {
          const context = fullFakeContext();
          let runCount = 0;
          const uow = createFakeUnitOfWork(context, () => { runCount += 1; });
          const svc = createPaperAccountSettingsService(uow);

          await expect(
            svc.updateNewAccountDefaults(validUpdateDefaults({ [field]: value })),
          ).rejects.toThrow("PAPER_ACCOUNT_RATE_INVALID");
          expect(runCount).toBe(0);
        });
      }
    });

    describe("bp validation", () => {
      const bpFields = ["maxSingleStockBp", "maxTotalPositionBp", "maxRiskBp"] as const;

      for (const field of bpFields) {
        const invalidBp = [-1, 10_001, 1.5, Number.MAX_SAFE_INTEGER + 1] as const;
        it.each(invalidBp)(`rejects ${field} = %s`, async (value: number) => {
          const context = fullFakeContext();
          let runCount = 0;
          const uow = createFakeUnitOfWork(context, () => { runCount += 1; });
          const svc = createPaperAccountSettingsService(uow);

          await expect(
            svc.updateNewAccountDefaults(validUpdateDefaults({ [field]: value })),
          ).rejects.toThrow("PAPER_ACCOUNT_BASIS_POINTS_INVALID");
          expect(runCount).toBe(0);
        });
      }
    });

    it("allows boundary values: ppm 0/1000000, bp 0/10000, cash 0", async () => {
      const settingsAppend = vi.fn().mockResolvedValue(defaultSettingsRecord({ version: 7 }));

      const context = fullFakeContext({
        settings: {
          findLatestByScope: vi.fn().mockResolvedValue(defaultSettingsRecord({ version: 7 })),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(null),
          append: settingsAppend,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));

      await svc.updateNewAccountDefaults(validUpdateDefaults({
        commissionRatePpm: 0,
        stampDutySellRatePpm: 1_000_000,
        transferFeeRatePpm: 0,
        maxSingleStockBp: 0,
        maxTotalPositionBp: 10_000,
        maxRiskBp: 0,
        initialCashForNewAccountsFen: BigInt("0"),
        minimumCommissionFen: BigInt("0"),
      }));

      expect(settingsAppend).toHaveBeenCalledTimes(1);
    });

    // 3 ── No trimming ────────────────────────────────────────────────────

    it("preserves whitespace in actorId and idempotencyKey", async () => {
      const settingsAppend = vi.fn().mockResolvedValue(defaultSettingsRecord());

      const context = fullFakeContext({
        settings: {
          findLatestByScope: vi.fn().mockResolvedValue(null),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(null),
          append: settingsAppend,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));

      await svc.updateNewAccountDefaults(validUpdateDefaults({
        actorId: "  settings-operator  ",
        idempotencyKey: "  settings-key  ",
      }));

      const call = settingsAppend.mock.calls[0][0] as PaperAccountSettingsVersionInput;
      expect(call.actorId).toBe("  settings-operator  ");
      expect(call.idempotencyKey).toBe("  settings-key  ");
    });

    // 4 ── Idempotent return ──────────────────────────────────────────────

    it("returns existing record on idempotent hit", async () => {
      const existing = defaultSettingsRecord({ version: 3 });
      const findLatestByScope = vi.fn();

      const context = fullFakeContext({
        settings: {
          findLatestByScope,
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(existing),
          append: unexpectedRepositoryCall,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));
      const result = await svc.updateNewAccountDefaults(validUpdateDefaults({
        idempotencyKey: "dup-key",
      }));

      expect(result).toBe(existing);
      expect(findLatestByScope).not.toHaveBeenCalled();
    });

    // 5 ── Idempotent hit wrong scope ─────────────────────────────────────

    it("rejects idempotent hit with wrong scopeKey", async () => {
      const existing = defaultSettingsRecord({ scopeKey: "other-scope" });

      const context = fullFakeContext({
        settings: {
          findLatestByScope: unexpectedRepositoryCall,
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(existing),
          append: unexpectedRepositoryCall,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));

      await expect(
        svc.updateNewAccountDefaults(validUpdateDefaults({ idempotencyKey: "bad-key" })),
      ).rejects.toThrow("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
    });

    it("rejects idempotent hit with non-null accountId", async () => {
      const existing = defaultSettingsRecord({ accountId: "some-acc" });

      const context = fullFakeContext({
        settings: {
          findLatestByScope: unexpectedRepositoryCall,
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(existing),
          append: unexpectedRepositoryCall,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));

      await expect(
        svc.updateNewAccountDefaults(validUpdateDefaults({ idempotencyKey: "bad-key" })),
      ).rejects.toThrow("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
    });

    // 6 ── First version when none exist ──────────────────────────────────

    it("creates version 1 when no template exists", async () => {
      const record = defaultSettingsRecord({ version: 1 });
      const settingsAppend = vi.fn().mockResolvedValue(record);

      const context = fullFakeContext({
        settings: {
          findLatestByScope: vi.fn().mockResolvedValue(null),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(null),
          append: settingsAppend,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));
      const input = validUpdateDefaults({ idempotencyKey: "first-key" });
      const result = await svc.updateNewAccountDefaults(input);

      expect(result.version).toBe(1);
      const call = settingsAppend.mock.calls[0][0] as PaperAccountSettingsVersionInput;
      expect(call.version).toBe(1);
      expect(call.idempotencyKey).toBe("first-key");
    });

    // 7 ── Append next version ────────────────────────────────────────────

    it("appends version latest + 1", async () => {
      const record = defaultSettingsRecord({ version: 8 });
      const settingsAppend = vi.fn().mockResolvedValue(record);

      const context = fullFakeContext({
        settings: {
          findLatestByScope: vi.fn().mockResolvedValue(defaultSettingsRecord({ version: 7 })),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(null),
          append: settingsAppend,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));
      const result = await svc.updateNewAccountDefaults(validUpdateDefaults());

      expect(result.version).toBe(8);
      const call = settingsAppend.mock.calls[0][0] as PaperAccountSettingsVersionInput;
      expect(call.version).toBe(8);
      expect(call.commissionRatePpm).toBe(validDefaultsInput.commissionRatePpm);
    });

    // 8 ── Version overflow ───────────────────────────────────────────────

    it("rejects when next version would overflow", async () => {
      const context = fullFakeContext({
        settings: {
          findLatestByScope: vi.fn().mockResolvedValue(defaultSettingsRecord({
            version: Number.MAX_SAFE_INTEGER,
          })),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(null),
          append: unexpectedRepositoryCall,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));

      await expect(
        svc.updateNewAccountDefaults(validUpdateDefaults()),
      ).rejects.toThrow("PAPER_ACCOUNT_SETTINGS_VERSION_INVALID");
    });

    it("rejects when latest version is 0", async () => {
      const context = fullFakeContext({
        settings: {
          findLatestByScope: vi.fn().mockResolvedValue(defaultSettingsRecord({ version: 0 })),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(null),
          append: unexpectedRepositoryCall,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));

      await expect(
        svc.updateNewAccountDefaults(validUpdateDefaults()),
      ).rejects.toThrow("PAPER_ACCOUNT_SETTINGS_VERSION_INVALID");
    });
  });

  // ── createAccountSettingsVersion ───────────────────────────────────────

  describe("createAccountSettingsVersion", () => {
    // 1 ── Basic input validation ─────────────────────────────────────────

    it("rejects blank accountId", async () => {
      const context = fullFakeContext();
      let runCount = 0;
      const uow = createFakeUnitOfWork(context, () => { runCount += 1; });
      const svc = createPaperAccountSettingsService(uow);

      await expect(
        svc.createAccountSettingsVersion(validCreateAccountSettings({ accountId: "   " })),
      ).rejects.toThrow("PAPER_ACCOUNT_ACCOUNT_ID_REQUIRED");
      expect(runCount).toBe(0);
    });

    // 9 ── INITIAL_CASH_IMMUTABLE ─────────────────────────────────────────

    it("rejects when initialCashForNewAccountsFen is explicitly provided (bigint 1)", async () => {
      const context = fullFakeContext();
      let runCount = 0;
      const uow = createFakeUnitOfWork(context, () => { runCount += 1; });
      const svc = createPaperAccountSettingsService(uow);

      // Reconstruct to have the property explicitly
      const fullInput = { ...validCreateAccountSettings() } as Record<string, unknown>;
      fullInput.initialCashForNewAccountsFen = BigInt("1");

      await expect(
        svc.createAccountSettingsVersion(fullInput as unknown as CreateAccountSettingsVersionInput),
      ).rejects.toThrow("INITIAL_CASH_IMMUTABLE");
      expect(runCount).toBe(0);
    });

    it("rejects when initialCashForNewAccountsFen is explicitly null", async () => {
      const context = fullFakeContext();
      let runCount = 0;
      const uow = createFakeUnitOfWork(context, () => { runCount += 1; });
      const svc = createPaperAccountSettingsService(uow);

      const fullInput = { ...validCreateAccountSettings() } as Record<string, unknown>;
      fullInput.initialCashForNewAccountsFen = null;

      await expect(
        svc.createAccountSettingsVersion(fullInput as unknown as CreateAccountSettingsVersionInput),
      ).rejects.toThrow("INITIAL_CASH_IMMUTABLE");
      expect(runCount).toBe(0);
    });

    it("rejects when initialCashForNewAccountsFen is explicitly undefined", async () => {
      const context = fullFakeContext();
      let runCount = 0;
      const uow = createFakeUnitOfWork(context, () => { runCount += 1; });
      const svc = createPaperAccountSettingsService(uow);

      const fullInput = { ...validCreateAccountSettings() } as Record<string, unknown>;
      fullInput.initialCashForNewAccountsFen = undefined;

      await expect(
        svc.createAccountSettingsVersion(fullInput as unknown as CreateAccountSettingsVersionInput),
      ).rejects.toThrow("INITIAL_CASH_IMMUTABLE");
      expect(runCount).toBe(0);
    });

    // 2 ── No trimming ────────────────────────────────────────────────────

    it("preserves whitespace in accountId, actorId, idempotencyKey", async () => {
      const acct = accountRecord({ id: "  account-1  " });
      const existingSettings = defaultSettingsRecord({
        scopeKey: "account:  account-1  ",
        accountId: "  account-1  ",
        version: 2,
      });
      const settingsAppend = vi.fn().mockResolvedValue(defaultSettingsRecord({ version: 3 }));

      const context = fullFakeContext({
        accounts: {
          findById: vi.fn().mockResolvedValue(acct),
          findByKey: unexpectedRepositoryCall,
          create: unexpectedRepositoryCall,
          updateCash: unexpectedRepositoryCall,
        },
        settings: {
          findLatestByScope: vi.fn().mockResolvedValue(existingSettings),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(null),
          append: settingsAppend,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));

      await svc.createAccountSettingsVersion(validCreateAccountSettings({
        accountId: "  account-1  ",
        actorId: "  operator  ",
        idempotencyKey: "  acct-key  ",
      }));

      expect(context.accounts.findById).toHaveBeenCalledWith("  account-1  ");
      const call = settingsAppend.mock.calls[0][0] as PaperAccountSettingsVersionInput;
      expect(call.scopeKey).toBe("account:  account-1  ");
      expect(call.actorId).toBe("  operator  ");
      expect(call.idempotencyKey).toBe("  acct-key  ");
    });

    // 10 ── Idempotent return ─────────────────────────────────────────────

    it("returns existing record on idempotent hit", async () => {
      const existing = defaultSettingsRecord({
        scopeKey: "account:account-1",
        accountId: "account-1",
      });

      const context = fullFakeContext({
        settings: {
          findLatestByScope: unexpectedRepositoryCall,
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(existing),
          append: unexpectedRepositoryCall,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));
      const result = await svc.createAccountSettingsVersion(validCreateAccountSettings());

      expect(result).toBe(existing);
    });

    // 11 ── Wrong entity on idempotent hit ────────────────────────────────

    it("rejects idempotent hit with different accountId", async () => {
      const existing = defaultSettingsRecord({
        scopeKey: "account:account-1",
        accountId: "other-account",
      });

      const context = fullFakeContext({
        settings: {
          findLatestByScope: unexpectedRepositoryCall,
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(existing),
          append: unexpectedRepositoryCall,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));

      await expect(
        svc.createAccountSettingsVersion(validCreateAccountSettings()),
      ).rejects.toThrow("PAPER_ACCOUNT_IDEMPOTENCY_CONFLICT");
    });

    // 12 ── Account not found ─────────────────────────────────────────────

    it("rejects when account does not exist", async () => {
      const context = fullFakeContext({
        accounts: {
          findById: vi.fn().mockResolvedValue(null),
          findByKey: unexpectedRepositoryCall,
          create: unexpectedRepositoryCall,
          updateCash: unexpectedRepositoryCall,
        },
        settings: {
          findLatestByScope: unexpectedRepositoryCall,
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(null),
          append: unexpectedRepositoryCall,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));

      await expect(
        svc.createAccountSettingsVersion(validCreateAccountSettings()),
      ).rejects.toThrow("PAPER_ACCOUNT_ACCOUNT_NOT_FOUND");
    });

    // 13 ── No initial settings ───────────────────────────────────────────

    it("rejects when account has no initial settings", async () => {
      const acct = accountRecord();

      const context = fullFakeContext({
        accounts: {
          findById: vi.fn().mockResolvedValue(acct),
          findByKey: unexpectedRepositoryCall,
          create: unexpectedRepositoryCall,
          updateCash: unexpectedRepositoryCall,
        },
        settings: {
          findLatestByScope: vi.fn().mockResolvedValue(null),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(null),
          append: unexpectedRepositoryCall,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));

      await expect(
        svc.createAccountSettingsVersion(validCreateAccountSettings()),
      ).rejects.toThrow("PAPER_ACCOUNT_SETTINGS_NOT_FOUND");
    });

    // 14 ── Append new version ────────────────────────────────────────────

    it("appends new account settings version", async () => {
      const acct = accountRecord();
      const existingSettings = defaultSettingsRecord({
        scopeKey: "account:account-1",
        accountId: "account-1",
        version: 3,
      });
      const newRecord = defaultSettingsRecord({
        id: "settings-4",
        version: 4,
        scopeKey: "account:account-1",
        accountId: "account-1",
        initialCashForNewAccountsFen: null,
      });
      const settingsAppend = vi.fn().mockResolvedValue(newRecord);

      const context = fullFakeContext({
        accounts: {
          findById: vi.fn().mockResolvedValue(acct),
          findByKey: unexpectedRepositoryCall,
          create: unexpectedRepositoryCall,
          updateCash: unexpectedRepositoryCall,
        },
        settings: {
          findLatestByScope: vi.fn().mockResolvedValue(existingSettings),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(null),
          append: settingsAppend,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));
      const input = validCreateAccountSettings();
      const result = await svc.createAccountSettingsVersion(input);

      expect(result.version).toBe(4);
      const call = settingsAppend.mock.calls[0][0] as PaperAccountSettingsVersionInput;
      expect(call.version).toBe(4);
      expect(call.scopeKey).toBe("account:account-1");
      expect(call.accountId).toBe("account-1");
      expect(call.initialCashForNewAccountsFen).toBeNull();
      expect(call.commissionRatePpm).toBe(input.commissionRatePpm);
    });

    // 15 ── Version overflow ──────────────────────────────────────────────

    it("rejects account settings version overflow", async () => {
      const acct = accountRecord();
      const existingSettings = defaultSettingsRecord({
        scopeKey: "account:account-1",
        accountId: "account-1",
        version: Number.MAX_SAFE_INTEGER,
      });

      const context = fullFakeContext({
        accounts: {
          findById: vi.fn().mockResolvedValue(acct),
          findByKey: unexpectedRepositoryCall,
          create: unexpectedRepositoryCall,
          updateCash: unexpectedRepositoryCall,
        },
        settings: {
          findLatestByScope: vi.fn().mockResolvedValue(existingSettings),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: vi.fn().mockResolvedValue(null),
          append: unexpectedRepositoryCall,
        },
      });

      const svc = createPaperAccountSettingsService(createFakeUnitOfWork(context));

      await expect(
        svc.createAccountSettingsVersion(validCreateAccountSettings()),
      ).rejects.toThrow("PAPER_ACCOUNT_SETTINGS_VERSION_INVALID");
    });
  });
});