import type { MoneyFen } from "@/lib/paper-account/paper-account-types";
import { assertSqliteInt64, formatFen, toDecimalString } from "../../lib/paper-account/money";
import type { PaperAccountUnitOfWork } from "./paper-account-unit-of-work";
import type { PaperAccountQuoteReader } from "./paper-account-quote-port";

export type PaperAccountSnapshotQuoteStatus = "fresh" | "unavailable";

export type PaperAccountSnapshot = {
  accountId: string;
  availableCashFen: MoneyFen;
  frozenCashFen: MoneyFen;
  positionMarketValueFen: MoneyFen | null;
  totalAssetsFen: MoneyFen | null;
  realizedPnlFen: MoneyFen;
  cumulativeFeesFen: MoneyFen;
  settingsVersion: number;
  quoteStatus: PaperAccountSnapshotQuoteStatus;
};

export type PaperAccountSnapshotDto = {
  availableCashFen: string;
  frozenCashFen: string;
  positionMarketValueFen: string | null;
  totalAssetsFen: string | null;
  realizedPnlFen: string;
  cumulativeFeesFen: string;
  availableCash: string;
  frozenCash: string;
  positionMarketValue: string | null;
  totalAssets: string | null;
};

export type GetPaperAccountSnapshotInput = {
  accountId: string;
  quoteReader: PaperAccountQuoteReader;
};

export type PaperAccountSnapshotService = {
  getPaperAccountSnapshot(
    input: GetPaperAccountSnapshotInput,
  ): Promise<PaperAccountSnapshot>;
};

// ── Private helpers ────────────────────────────────────────────────────────

function assertAccountId(accountId: string): void {
  if (accountId.trim().length === 0) {
    throw new Error("PAPER_ACCOUNT_ACCOUNT_ID_REQUIRED");
  }
}

function isSafeNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function makeUnavailableSnapshot(
  accountId: string,
  availableCashFen: MoneyFen,
  frozenCashFen: MoneyFen,
  realizedPnlFen: MoneyFen,
  cumulativeFeesFen: MoneyFen,
  settingsVersion: number,
): PaperAccountSnapshot {
  return {
    accountId,
    availableCashFen,
    frozenCashFen,
    positionMarketValueFen: null,
    totalAssetsFen: null,
    realizedPnlFen,
    cumulativeFeesFen,
    settingsVersion,
    quoteStatus: "unavailable",
  };
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createPaperAccountSnapshotService(
  unitOfWork: PaperAccountUnitOfWork,
): PaperAccountSnapshotService {
  return {
    async getPaperAccountSnapshot(input) {
      assertAccountId(input.accountId);

      const readModel = await unitOfWork.run(async (context) => {
        const account = await context.accounts.findById(input.accountId);
        if (account === null) {
          throw new Error("PAPER_ACCOUNT_ACCOUNT_NOT_FOUND");
        }

        const settings = await context.settings.findLatestByScope(
          `account:${input.accountId}`,
        );
        if (settings === null) {
          throw new Error("PAPER_ACCOUNT_SETTINGS_NOT_FOUND");
        }

        const positions = await context.positions.listByAccount(input.accountId);

        return { account, settingsVersion: settings.version, positions };
      });

      const { account, settingsVersion, positions } = readModel;

      // Validate position quantities and collect positive positions
      const positivePositions = [];
      for (const position of positions) {
        if (!isSafeNonNegativeInteger(position.totalQuantity)) {
          throw new Error("PAPER_ACCOUNT_POSITION_QUANTITY_INVALID");
        }
        if (position.totalQuantity > 0) {
          positivePositions.push(position);
        }
      }

      // No positive positions — no quote needed
      if (positivePositions.length === 0) {
        const totalAssetsFen = assertSqliteInt64(
          account.availableCashFen + account.frozenCashFen,
        );
        return {
          accountId: account.id,
          availableCashFen: account.availableCashFen,
          frozenCashFen: account.frozenCashFen,
          positionMarketValueFen: BigInt("0"),
          totalAssetsFen,
          realizedPnlFen: account.realizedPnlFen,
          cumulativeFeesFen: account.cumulativeFeesFen,
          settingsVersion,
          quoteStatus: "fresh",
        };
      }

      // Deduplicate and sort codes
      const codes = [
        ...new Set(positivePositions.map((p) => p.code)),
      ].sort((a, b) => a.localeCompare(b));

      // Fetch quotes (only catches quoteReader exceptions)
      let quotes;
      try {
        quotes = await input.quoteReader.getLatestQuotes(codes);
      } catch {
        return makeUnavailableSnapshot(
          account.id,
          account.availableCashFen,
          account.frozenCashFen,
          account.realizedPnlFen,
          account.cumulativeFeesFen,
          settingsVersion,
        );
      }

      // Validate all quotes present and fresh
      for (const code of codes) {
        const quote = quotes.get(code);
        if (
          quote === undefined ||
          quote.status !== "fresh" ||
          typeof quote.priceFen !== "bigint" ||
          quote.priceFen <= BigInt("0")
        ) {
          return makeUnavailableSnapshot(
            account.id,
            account.availableCashFen,
            account.frozenCashFen,
            account.realizedPnlFen,
            account.cumulativeFeesFen,
            settingsVersion,
          );
        }
      }

      // Compute market value
      let positionMarketValueFen = BigInt("0");
      for (const position of positivePositions) {
        const quote = quotes.get(position.code)!;
        const positionValueFen = assertSqliteInt64(
          BigInt(position.totalQuantity) * quote.priceFen,
        );
        positionMarketValueFen = assertSqliteInt64(
          positionMarketValueFen + positionValueFen,
        );
      }

      const totalAssetsFen = assertSqliteInt64(
        account.availableCashFen +
          account.frozenCashFen +
          positionMarketValueFen,
      );

      return {
        accountId: account.id,
        availableCashFen: account.availableCashFen,
        frozenCashFen: account.frozenCashFen,
        positionMarketValueFen,
        totalAssetsFen,
        realizedPnlFen: account.realizedPnlFen,
        cumulativeFeesFen: account.cumulativeFeesFen,
        settingsVersion,
        quoteStatus: "fresh",
      };
    },
  };
}

// ── Serialization ──────────────────────────────────────────────────────────

export function serializePaperAccountSnapshot(
  snapshot: PaperAccountSnapshot,
): PaperAccountSnapshotDto {
  return {
    availableCashFen: toDecimalString(snapshot.availableCashFen),
    frozenCashFen: toDecimalString(snapshot.frozenCashFen),
    positionMarketValueFen:
      snapshot.positionMarketValueFen === null
        ? null
        : toDecimalString(snapshot.positionMarketValueFen),
    totalAssetsFen:
      snapshot.totalAssetsFen === null
        ? null
        : toDecimalString(snapshot.totalAssetsFen),
    realizedPnlFen: toDecimalString(snapshot.realizedPnlFen),
    cumulativeFeesFen: toDecimalString(snapshot.cumulativeFeesFen),
    availableCash: formatFen(snapshot.availableCashFen),
    frozenCash: formatFen(snapshot.frozenCashFen),
    positionMarketValue:
      snapshot.positionMarketValueFen === null
        ? null
        : formatFen(snapshot.positionMarketValueFen),
    totalAssets:
      snapshot.totalAssetsFen === null
        ? null
        : formatFen(snapshot.totalAssetsFen),
  };
}