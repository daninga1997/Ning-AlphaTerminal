import { describe, expect, it, vi } from "vitest";
import type {
  CashLedgerDirection,
  CashLedgerType,
  PaperAccountStatus,
} from "@prisma/client";
import type {
  PaperAccountTransactionContext,
  PaperAccountUnitOfWork,
} from "./paper-account-unit-of-work";
import type {
  CashLedgerEntryInput,
  CashLedgerEntryRecord,
  CreatePaperAccountInput,
  PaperAccountRecord,
  PaperAccountSettingsVersionInput,
  PaperAccountSettingsVersionRecord,
  PaperAuditLogInput,
  PaperAuditLogRecord,
} from "./paper-account-repositories";
import {
  createPaperAccountInitializer,
} from "./paper-account-initializer";

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

function defaultAccount(
  overrides: Partial<PaperAccountRecord> = {},
): PaperAccountRecord {
  return {
    id: "account-1",
    accountKey: "paper-default",
    initialCashFen: BigInt("10000000"),
    availableCashFen: BigInt("10000000"),
    frozenCashFen: BigInt("0"),
    realizedPnlFen: BigInt("0"),
    cumulativeFeesFen: BigInt("0"),
    accountVersion: 1,
    status: "active" as PaperAccountStatus,
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
    ...overrides,
  };
}

function defaultSettingsTemplate(
  overrides: Partial<PaperAccountSettingsVersionRecord> = {},
): PaperAccountSettingsVersionRecord {
  return {
    id: "default-settings-1",
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
    actorId: "system",
    idempotencyKey: "paper-account:new-account-default:v1",
    createdAt: "2026-08-04T00:00:00.000Z",
    ...overrides,
  };
}

function accountSettingsRecord(
  template: PaperAccountSettingsVersionRecord,
  accountId: string,
  actorId: string,
  idempotencyKey: string,
): PaperAccountSettingsVersionRecord {
  return {
    ...template,
    id: "account-settings-1",
    scopeKey: `account:${accountId}`,
    accountId,
    version: 1,
    initialCashForNewAccountsFen: null,
    actorId,
    idempotencyKey,
  };
}

function defaultLedgerEntry(
  overrides: Partial<CashLedgerEntryRecord> = {},
): CashLedgerEntryRecord {
  return {
    id: "ledger-1",
    accountId: "account-1",
    orderId: null,
    sequence: 1,
    direction: "credit" as CashLedgerDirection,
    type: "initial_cash" as CashLedgerType,
    amountFen: BigInt("10000000"),
    balanceAfterFen: BigInt("10000000"),
    idempotencyKey: "key:initial-cash",
    metadataJson: JSON.stringify({
      reason: "initial_account_funding",
      actorId: "initializer",
      defaultSettingsVersion: 1,
      accountSettingsVersion: 1,
    }),
    occurredAt: "2026-08-04T02:00:00.000Z",
    createdAt: "2026-08-04T02:00:00.100Z",
    ...overrides,
  };
}

function defaultAuditLog(
  overrides: Partial<PaperAuditLogRecord> = {},
): PaperAuditLogRecord {
  return {
    id: "audit-1",
    accountId: "account-1",
    sequence: 1,
    action: "account_initialized",
    actorId: "initializer",
    entityType: "PaperAccount",
    entityId: "account-1",
    payloadJson: JSON.stringify({
      accountKey: "paper-default",
      initialCashFen: "10000000",
      defaultSettingsVersion: 1,
      accountSettingsVersion: 1,
    }),
    idempotencyKey: "key:account-initialized",
    occurredAt: "2026-08-04T02:00:00.000Z",
    createdAt: "2026-08-04T02:00:00.100Z",
    ...overrides,
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

// ── Valid input ─────────────────────────────────────────────────────────────

const validInput = {
  accountKey: "paper-default",
  actorId: "initializer",
  occurredAt: "2026-08-04T02:00:00.000Z",
  idempotencyKey: "initialize-1",
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PaperAccountInitializer (unit)", () => {
  // 1 ── Blank input rejects before Unit of Work ──────────────────────────

  describe("input validation before transaction", () => {
    it("rejects blank accountKey", async () => {
      const context = fullFakeContext();
      let runCount = 0;
      const uow = createFakeUnitOfWork(context, () => {
        runCount += 1;
      });
      const init = createPaperAccountInitializer(uow);

      await expect(
        init.initializeDefaultPaperAccount({
          ...validInput,
          accountKey: "   ",
        }),
      ).rejects.toThrow("PAPER_ACCOUNT_ACCOUNT_KEY_REQUIRED");

      expect(runCount).toBe(0);
    });

    it("rejects blank actorId", async () => {
      const context = fullFakeContext();
      let runCount = 0;
      const uow = createFakeUnitOfWork(context, () => {
        runCount += 1;
      });
      const init = createPaperAccountInitializer(uow);

      await expect(
        init.initializeDefaultPaperAccount({
          ...validInput,
          actorId: "   ",
        }),
      ).rejects.toThrow("PAPER_ACCOUNT_ACTOR_ID_REQUIRED");

      expect(runCount).toBe(0);
    });

    it("rejects blank idempotencyKey", async () => {
      const context = fullFakeContext();
      let runCount = 0;
      const uow = createFakeUnitOfWork(context, () => {
        runCount += 1;
      });
      const init = createPaperAccountInitializer(uow);

      await expect(
        init.initializeDefaultPaperAccount({
          ...validInput,
          idempotencyKey: "   ",
        }),
      ).rejects.toThrow("PAPER_ACCOUNT_IDEMPOTENCY_KEY_REQUIRED");

      expect(runCount).toBe(0);
    });
  });

  // 2 ── Non-canonical dates reject before Unit of Work ───────────────────

  describe("date validation before transaction", () => {
    const invalidDates = [
      "not-a-date",
      "2026-08-04",
      "2026-08-04T00:00:00Z",
      "2026-08-04T08:00:00.000+08:00",
      "+010000-01-01T00:00:00.000Z",
      "2026-02-30T00:00:00.000Z",
    ];

    it.each(invalidDates)(
      "rejects %s",
      async (dateValue: string) => {
        const context = fullFakeContext();
        let runCount = 0;
        const uow = createFakeUnitOfWork(context, () => {
          runCount += 1;
        });
        const init = createPaperAccountInitializer(uow);

        await expect(
          init.initializeDefaultPaperAccount({
            ...validInput,
            occurredAt: dateValue,
          }),
        ).rejects.toThrow("PAPER_ACCOUNT_DATE_INVALID");

        expect(runCount).toBe(0);
      },
    );

    it("allows valid canonical format 2026-08-04T00:00:00.000Z", async () => {
      const template = defaultSettingsTemplate();
      const account = defaultAccount();
      const acctSettings = accountSettingsRecord(
        template,
        account.id,
        validInput.actorId,
        `${validInput.idempotencyKey}:account-settings:v1`,
      );
      const ledgerEntry = defaultLedgerEntry({
        accountId: account.id,
        amountFen: template.initialCashForNewAccountsFen!,
        balanceAfterFen: template.initialCashForNewAccountsFen!,
      });
      const auditEntry = defaultAuditLog({ accountId: account.id });

      const context = fullFakeContext({
        accounts: {
          findById: unexpectedRepositoryCall,
          findByKey: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(account),
          updateCash: unexpectedRepositoryCall,
        },
        settings: {
          findLatestByScope: vi
            .fn()
            .mockImplementation((scopeKey: string) => {
              if (scopeKey === "new-account-default") {
                return Promise.resolve(template);
              }
              if (scopeKey === `account:${account.id}`) {
                return Promise.resolve(acctSettings);
              }
              return Promise.resolve(null);
            }),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: unexpectedRepositoryCall,
          append: vi
            .fn()
            .mockResolvedValueOnce(acctSettings)
            .mockResolvedValueOnce(acctSettings),
        },
        ledger: {
          findByIdempotencyKey: unexpectedRepositoryCall,
          listByAccount: unexpectedRepositoryCall,
          sumByAccount: unexpectedRepositoryCall,
          append: vi.fn().mockResolvedValue(ledgerEntry),
        },
        audit: {
          findByIdempotencyKey: unexpectedRepositoryCall,
          listByAccount: unexpectedRepositoryCall,
          append: vi.fn().mockResolvedValue(auditEntry),
        },
      });

      const init = createPaperAccountInitializer(
        createFakeUnitOfWork(context),
      );

      const result = await init.initializeDefaultPaperAccount({
        ...validInput,
        occurredAt: "2026-08-04T00:00:00.000Z",
      });

      expect(result.created).toBe(true);
    });
  });

  // 3 ── Strings are NOT silently trimmed ─────────────────────────────────

  it("preserves whitespace in input strings without trimming", async () => {
    const template = defaultSettingsTemplate();
    const account = defaultAccount({
      id: "ws-account",
      accountKey: "  paper-account  ",
    });
    const acctSettings = accountSettingsRecord(
      template,
      account.id,
      "  operator  ",
      "  initialize-key  :account-settings:v1",
    );
    const ledgerEntry = defaultLedgerEntry({
      accountId: account.id,
      amountFen: template.initialCashForNewAccountsFen!,
      balanceAfterFen: template.initialCashForNewAccountsFen!,
    });
    const auditEntry = defaultAuditLog({ accountId: account.id });

    const findByKey = vi.fn().mockResolvedValue(null);
    const accountsCreate = vi.fn().mockResolvedValue(account);
    const settingsFindLatestByScope = vi
      .fn()
      .mockImplementation((scopeKey: string) => {
        if (scopeKey === "new-account-default") {
          return Promise.resolve(template);
        }
        if (scopeKey === `account:${account.id}`) {
          return Promise.resolve(acctSettings);
        }
        return Promise.resolve(null);
      });
    const settingsAppend = vi
      .fn()
      .mockResolvedValueOnce(acctSettings)
      .mockResolvedValueOnce(acctSettings);
    const ledgerAppend = vi.fn().mockResolvedValue(ledgerEntry);
    const auditAppend = vi.fn().mockResolvedValue(auditEntry);

    const context = fullFakeContext({
      accounts: {
        findById: unexpectedRepositoryCall,
        findByKey,
        create: accountsCreate,
        updateCash: unexpectedRepositoryCall,
      },
      settings: {
        findLatestByScope: settingsFindLatestByScope,
        listByScope: unexpectedRepositoryCall,
        findByIdempotencyKey: unexpectedRepositoryCall,
        append: settingsAppend,
      },
      ledger: {
        findByIdempotencyKey: unexpectedRepositoryCall,
        listByAccount: unexpectedRepositoryCall,
        sumByAccount: unexpectedRepositoryCall,
        append: ledgerAppend,
      },
      audit: {
        findByIdempotencyKey: unexpectedRepositoryCall,
        listByAccount: unexpectedRepositoryCall,
        append: auditAppend,
      },
    });

    const init = createPaperAccountInitializer(
      createFakeUnitOfWork(context),
    );

    await init.initializeDefaultPaperAccount({
      accountKey: "  paper-account  ",
      actorId: "  operator  ",
      occurredAt: "2026-08-04T00:00:00.000Z",
      idempotencyKey: "  initialize-key  ",
    });

    // findByKey must receive the original string, not trimmed
    expect(findByKey).toHaveBeenCalledWith("  paper-account  ");

    // accounts.create must preserve the original accountKey
    const createCall = accountsCreate.mock
      .calls[0][0] as CreatePaperAccountInput;
    expect(createCall.accountKey).toBe("  paper-account  ");

    // settings.append (first call for account settings) must preserve actorId
    const settingsFirstCall = settingsAppend.mock
      .calls[0][0] as PaperAccountSettingsVersionInput;
    expect(settingsFirstCall.actorId).toBe("  operator  ");

    // audit.append must preserve actorId
    const auditCall = auditAppend.mock
      .calls[0][0] as PaperAuditLogInput;
    expect(auditCall.actorId).toBe("  operator  ");
  });

  // 4 ── Existing complete account returns idempotent ─────────────────────

  it("returns existing account without any writes", async () => {
    const existingAccount = defaultAccount({
      id: "existing-acc",
      accountKey: "paper-default",
    });
    const existingSettings = accountSettingsRecord(
      defaultSettingsTemplate(),
      existingAccount.id,
      "initializer",
      "some-settings-key",
    );

    const findByKey = vi.fn().mockResolvedValue(existingAccount);
    const findLatestByScope = vi
      .fn()
      .mockImplementation((scopeKey: string) => {
        if (scopeKey === `account:${existingAccount.id}`) {
          return Promise.resolve(existingSettings);
        }
        return Promise.resolve(null);
      });

    const context = fullFakeContext({
      accounts: {
        findById: unexpectedRepositoryCall,
        findByKey,
        create: unexpectedRepositoryCall,
        updateCash: unexpectedRepositoryCall,
      },
      settings: {
        findLatestByScope,
        listByScope: unexpectedRepositoryCall,
        findByIdempotencyKey: unexpectedRepositoryCall,
        append: unexpectedRepositoryCall,
      },
    });

    const init = createPaperAccountInitializer(
      createFakeUnitOfWork(context),
    );

    const result = await init.initializeDefaultPaperAccount(validInput);

    expect(result).toEqual({
      accountId: existingAccount.id,
      created: false,
      initialCashFen: existingAccount.initialCashFen,
      settingsVersion: existingSettings.version,
    });

    // Must NOT have queried default template
    expect(findLatestByScope).not.toHaveBeenCalledWith(
      "new-account-default",
    );

    expect(findByKey).toHaveBeenCalledWith(validInput.accountKey);
  });

  // 5 ── Existing account missing settings throws ────────────────────────

  it("refuses to patch incomplete account", async () => {
    const existingAccount = defaultAccount({
      id: "incomplete-acc",
      accountKey: "paper-default",
    });

    const context = fullFakeContext({
      accounts: {
        findById: unexpectedRepositoryCall,
        findByKey: vi.fn().mockResolvedValue(existingAccount),
        create: unexpectedRepositoryCall,
        updateCash: unexpectedRepositoryCall,
      },
      settings: {
        findLatestByScope: vi.fn().mockResolvedValue(null),
        listByScope: unexpectedRepositoryCall,
        findByIdempotencyKey: unexpectedRepositoryCall,
        append: unexpectedRepositoryCall,
      },
    });

    const init = createPaperAccountInitializer(
      createFakeUnitOfWork(context),
    );

    await expect(
      init.initializeDefaultPaperAccount(validInput),
    ).rejects.toThrow("PAPER_ACCOUNT_INITIALIZATION_INCOMPLETE");
  });

  // 6 ── Creates default template v1 when none exist ──────────────────────

  it("creates default settings template version 1", async () => {
    const template = defaultSettingsTemplate();
    const account = defaultAccount({ id: "new-acc-6" });
    const acctSettings = accountSettingsRecord(
      template,
      account.id,
      validInput.actorId,
      `${validInput.idempotencyKey}:account-settings:v1`,
    );

    const findLatestByScope = vi.fn().mockResolvedValue(null);
    const settingsAppend = vi
      .fn()
      .mockResolvedValueOnce(template)
      .mockResolvedValueOnce(acctSettings);
    const accountsCreate = vi.fn().mockResolvedValue(account);
    const ledgerAppend = vi.fn().mockResolvedValue(
      defaultLedgerEntry({ accountId: account.id }),
    );
    const auditAppend = vi.fn().mockResolvedValue(
      defaultAuditLog({ accountId: account.id }),
    );

    const context = fullFakeContext({
      accounts: {
        findById: unexpectedRepositoryCall,
        findByKey: vi.fn().mockResolvedValue(null),
        create: accountsCreate,
        updateCash: unexpectedRepositoryCall,
      },
      settings: {
        findLatestByScope,
        listByScope: unexpectedRepositoryCall,
        findByIdempotencyKey: unexpectedRepositoryCall,
        append: settingsAppend,
      },
      ledger: {
        findByIdempotencyKey: unexpectedRepositoryCall,
        listByAccount: unexpectedRepositoryCall,
        sumByAccount: unexpectedRepositoryCall,
        append: ledgerAppend,
      },
      audit: {
        findByIdempotencyKey: unexpectedRepositoryCall,
        listByAccount: unexpectedRepositoryCall,
        append: auditAppend,
      },
    });

    const init = createPaperAccountInitializer(
      createFakeUnitOfWork(context),
    );

    const result = await init.initializeDefaultPaperAccount(validInput);

    expect(result.created).toBe(true);

    // First settings.append must create the default template v1
    const firstSettingsCall = settingsAppend.mock
      .calls[0][0] as PaperAccountSettingsVersionInput;
    expect(firstSettingsCall).toEqual({
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
      actorId: validInput.actorId,
      occurredAt: validInput.occurredAt,
      idempotencyKey: "paper-account:new-account-default:v1",
    });

    expect(settingsAppend).toHaveBeenCalledTimes(2);
  });

  // 7 ── Copies latest template values ────────────────────────────────────

  it("copies values from latest default template", async () => {
    const latestTemplate = defaultSettingsTemplate({
      version: 7,
      initialCashForNewAccountsFen: BigInt("25000000"),
      commissionRatePpm: 300,
      minimumCommissionFen: BigInt("600"),
      stampDutySellRatePpm: 550,
      transferFeeRatePpm: 12,
      maxSingleStockBp: 2500,
      maxTotalPositionBp: 7000,
      maxRiskBp: 150,
    });
    const account = defaultAccount({
      id: "new-acc-7",
      initialCashFen: BigInt("25000000"),
      availableCashFen: BigInt("25000000"),
    });
    const acctSettings = accountSettingsRecord(
      latestTemplate,
      account.id,
      validInput.actorId,
      `${validInput.idempotencyKey}:account-settings:v1`,
    );

    const settingsAppend = vi
      .fn()
      .mockResolvedValueOnce(acctSettings);
    const accountsCreate = vi.fn().mockResolvedValue(account);
    const ledgerAppend = vi.fn().mockResolvedValue(
      defaultLedgerEntry({
        accountId: account.id,
        amountFen: BigInt("25000000"),
        balanceAfterFen: BigInt("25000000"),
      }),
    );
    const auditAppend = vi.fn().mockResolvedValue(
      defaultAuditLog({ accountId: account.id }),
    );

    const context = fullFakeContext({
      accounts: {
        findById: unexpectedRepositoryCall,
        findByKey: vi.fn().mockResolvedValue(null),
        create: accountsCreate,
        updateCash: unexpectedRepositoryCall,
      },
      settings: {
        findLatestByScope: vi
          .fn()
          .mockImplementation((scopeKey: string) => {
            if (scopeKey === "new-account-default") {
              return Promise.resolve(latestTemplate);
            }
            if (scopeKey === `account:${account.id}`) {
              return Promise.resolve(acctSettings);
            }
            return Promise.resolve(null);
          }),
        listByScope: unexpectedRepositoryCall,
        findByIdempotencyKey: unexpectedRepositoryCall,
        append: settingsAppend,
      },
      ledger: {
        findByIdempotencyKey: unexpectedRepositoryCall,
        listByAccount: unexpectedRepositoryCall,
        sumByAccount: unexpectedRepositoryCall,
        append: ledgerAppend,
      },
      audit: {
        findByIdempotencyKey: unexpectedRepositoryCall,
        listByAccount: unexpectedRepositoryCall,
        append: auditAppend,
      },
    });

    const init = createPaperAccountInitializer(
      createFakeUnitOfWork(context),
    );

    const result = await init.initializeDefaultPaperAccount(validInput);

    // accounts.create uses template's cash
    const createCall = accountsCreate.mock
      .calls[0][0] as CreatePaperAccountInput;
    expect(createCall.initialCashFen).toBe(BigInt("25000000"));

    // account settings version is 1, copies template params
    const settingsCall = settingsAppend.mock
      .calls[0][0] as PaperAccountSettingsVersionInput;
    expect(settingsCall.version).toBe(1);
    expect(settingsCall.commissionRatePpm).toBe(300);
    expect(settingsCall.minimumCommissionFen).toBe(BigInt("600"));
    expect(settingsCall.stampDutySellRatePpm).toBe(550);
    expect(settingsCall.transferFeeRatePpm).toBe(12);
    expect(settingsCall.maxSingleStockBp).toBe(2500);
    expect(settingsCall.maxTotalPositionBp).toBe(7000);
    expect(settingsCall.maxRiskBp).toBe(150);
    expect(settingsCall.initialCashForNewAccountsFen).toBeNull();

    // ledger amounts match template
    const ledgerCall = ledgerAppend.mock
      .calls[0][0] as CashLedgerEntryInput;
    expect(ledgerCall.amountFen).toBe(BigInt("25000000"));
    expect(ledgerCall.balanceAfterFen).toBe(BigInt("25000000"));

    const metadata = JSON.parse(ledgerCall.metadataJson!);
    expect(metadata.defaultSettingsVersion).toBe(7);

    const auditCall = auditAppend.mock
      .calls[0][0] as PaperAuditLogInput;
    const payload = JSON.parse(auditCall.payloadJson);
    expect(payload.defaultSettingsVersion).toBe(7);

    expect(result.settingsVersion).toBe(1);
  });

  // 8 ── Rejects invalid default template ─────────────────────────────────

  describe("rejects invalid default template", () => {
    it("rejects template with non-null accountId", async () => {
      const badTemplate = defaultSettingsTemplate({
        accountId: "some-account",
      });

      const context = fullFakeContext({
        accounts: {
          findById: unexpectedRepositoryCall,
          findByKey: vi.fn().mockResolvedValue(null),
          create: unexpectedRepositoryCall,
          updateCash: unexpectedRepositoryCall,
        },
        settings: {
          findLatestByScope: vi.fn().mockResolvedValue(badTemplate),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: unexpectedRepositoryCall,
          append: unexpectedRepositoryCall,
        },
      });

      const init = createPaperAccountInitializer(
        createFakeUnitOfWork(context),
      );

      await expect(
        init.initializeDefaultPaperAccount(validInput),
      ).rejects.toThrow("PAPER_ACCOUNT_DEFAULT_SETTINGS_INVALID");
    });

    it("rejects template with null initialCashForNewAccountsFen", async () => {
      const badTemplate = defaultSettingsTemplate({
        initialCashForNewAccountsFen: null,
      });

      const context = fullFakeContext({
        accounts: {
          findById: unexpectedRepositoryCall,
          findByKey: vi.fn().mockResolvedValue(null),
          create: unexpectedRepositoryCall,
          updateCash: unexpectedRepositoryCall,
        },
        settings: {
          findLatestByScope: vi.fn().mockResolvedValue(badTemplate),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: unexpectedRepositoryCall,
          append: unexpectedRepositoryCall,
        },
      });

      const init = createPaperAccountInitializer(
        createFakeUnitOfWork(context),
      );

      await expect(
        init.initializeDefaultPaperAccount(validInput),
      ).rejects.toThrow("PAPER_ACCOUNT_DEFAULT_SETTINGS_INVALID");
    });

    it("rejects template with negative initialCashForNewAccountsFen", async () => {
      const badTemplate = defaultSettingsTemplate({
        initialCashForNewAccountsFen: BigInt("-1"),
      });

      const context = fullFakeContext({
        accounts: {
          findById: unexpectedRepositoryCall,
          findByKey: vi.fn().mockResolvedValue(null),
          create: unexpectedRepositoryCall,
          updateCash: unexpectedRepositoryCall,
        },
        settings: {
          findLatestByScope: vi.fn().mockResolvedValue(badTemplate),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: unexpectedRepositoryCall,
          append: unexpectedRepositoryCall,
        },
      });

      const init = createPaperAccountInitializer(
        createFakeUnitOfWork(context),
      );

      await expect(
        init.initializeDefaultPaperAccount(validInput),
      ).rejects.toThrow("PAPER_ACCOUNT_DEFAULT_INITIAL_CASH_INVALID");
    });
  });

  // 9 ── New account contract precision ───────────────────────────────────

  it("writes exact contract for new account initialization", async () => {
    const template = defaultSettingsTemplate({ version: 3 });
    const account = defaultAccount({
      id: "new-acc-9",
      initialCashFen: BigInt("10000000"),
      availableCashFen: BigInt("10000000"),
    });
    const acctSettings = accountSettingsRecord(
      template,
      account.id,
      validInput.actorId,
      `${validInput.idempotencyKey}:account-settings:v1`,
    );

    const accountsCreate = vi.fn().mockResolvedValue(account);
    const settingsAppend = vi.fn().mockResolvedValueOnce(acctSettings);
    const ledgerAppend = vi.fn().mockResolvedValue(
      defaultLedgerEntry({
        accountId: account.id,
        idempotencyKey: `${validInput.idempotencyKey}:initial-cash`,
      }),
    );
    const auditAppend = vi.fn().mockResolvedValue(
      defaultAuditLog({
        accountId: account.id,
        idempotencyKey: `${validInput.idempotencyKey}:account-initialized`,
      }),
    );

    let runCount = 0;
    const uow = createFakeUnitOfWork(
      fullFakeContext({
        accounts: {
          findById: unexpectedRepositoryCall,
          findByKey: vi.fn().mockResolvedValue(null),
          create: accountsCreate,
          updateCash: unexpectedRepositoryCall,
        },
        settings: {
          findLatestByScope: vi
            .fn()
            .mockImplementation((scopeKey: string) => {
              if (scopeKey === "new-account-default") {
                return Promise.resolve(template);
              }
              if (scopeKey === `account:${account.id}`) {
                return Promise.resolve(acctSettings);
              }
              return Promise.resolve(null);
            }),
          listByScope: unexpectedRepositoryCall,
          findByIdempotencyKey: unexpectedRepositoryCall,
          append: settingsAppend,
        },
        ledger: {
          findByIdempotencyKey: unexpectedRepositoryCall,
          listByAccount: unexpectedRepositoryCall,
          sumByAccount: unexpectedRepositoryCall,
          append: ledgerAppend,
        },
        audit: {
          findByIdempotencyKey: unexpectedRepositoryCall,
          listByAccount: unexpectedRepositoryCall,
          append: auditAppend,
        },
      }),
      () => {
        runCount += 1;
      },
    );

    const init = createPaperAccountInitializer(uow);
    const result = await init.initializeDefaultPaperAccount(validInput);

    expect(runCount).toBe(1);

    const createCall = accountsCreate.mock
      .calls[0][0] as CreatePaperAccountInput;
    expect(createCall).toEqual({
      accountKey: validInput.accountKey,
      initialCashFen: template.initialCashForNewAccountsFen,
      status: "active",
    });

    const settingsCall = settingsAppend.mock
      .calls[0][0] as PaperAccountSettingsVersionInput;
    expect(settingsCall.version).toBe(1);
    expect(settingsCall.idempotencyKey).toBe(
      `${validInput.idempotencyKey}:account-settings:v1`,
    );

    const ledgerCall = ledgerAppend.mock
      .calls[0][0] as CashLedgerEntryInput;
    expect(ledgerCall.accountId).toBe(account.id);
    expect(ledgerCall.orderId).toBeNull();
    expect(ledgerCall.sequence).toBe(1);
    expect(ledgerCall.direction).toBe("credit");
    expect(ledgerCall.type).toBe("initial_cash");
    expect(ledgerCall.amountFen).toBe(ledgerCall.balanceAfterFen);
    expect(ledgerCall.idempotencyKey).toBe(
      `${validInput.idempotencyKey}:initial-cash`,
    );
    expect(ledgerCall.occurredAt).toBe(validInput.occurredAt);

    const metadata = JSON.parse(ledgerCall.metadataJson!);
    expect(metadata).toEqual({
      reason: "initial_account_funding",
      actorId: validInput.actorId,
      defaultSettingsVersion: template.version,
      accountSettingsVersion: acctSettings.version,
    });

    const auditCall = auditAppend.mock
      .calls[0][0] as PaperAuditLogInput;
    expect(auditCall.sequence).toBe(1);
    expect(auditCall.action).toBe("account_initialized");
    expect(auditCall.actorId).toBe(validInput.actorId);
    expect(auditCall.entityType).toBe("PaperAccount");
    expect(auditCall.entityId).toBe(account.id);
    expect(auditCall.idempotencyKey).toBe(
      `${validInput.idempotencyKey}:account-initialized`,
    );

    const payload = JSON.parse(auditCall.payloadJson);
    expect(payload).toEqual({
      accountKey: validInput.accountKey,
      initialCashFen: template.initialCashForNewAccountsFen!.toString(),
      defaultSettingsVersion: template.version,
      accountSettingsVersion: acctSettings.version,
    });

    expect(result).toEqual({
      accountId: account.id,
      created: true,
      initialCashFen: account.initialCashFen,
      settingsVersion: acctSettings.version,
    });
    expect(typeof result.initialCashFen).toBe("bigint");
  });
});