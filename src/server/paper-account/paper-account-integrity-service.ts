import type { CashLedgerDirection } from "@prisma/client";
import type { MoneyFen } from "@/lib/paper-account/paper-account-types";
import { assertSqliteInt64 } from "../../lib/paper-account/money";
import type { } from "./paper-account-repositories";
import type { PaperAccountUnitOfWork } from "./paper-account-unit-of-work";

export type PaperAccountIntegrityResult = {
  valid: boolean;
  issues: string[];
  ledgerCashFen: MoneyFen;
  cachedCashFen: MoneyFen;
};

export type PaperAccountIntegrityService = {
  checkPaperAccountIntegrity(
    accountId: string,
  ): Promise<PaperAccountIntegrityResult>;
};

function assertAccountId(accountId: string): void {
  if (accountId.trim().length === 0) {
    throw new Error("PAPER_ACCOUNT_ACCOUNT_ID_REQUIRED");
  }
}

function appends(issues: string[], seen: Set<string>, issue: string): void {
  if (!seen.has(issue)) {
    seen.add(issue);
    issues.push(issue);
  }
}

function isBigIntNonNegative(value: unknown): boolean {
  return typeof value === "bigint" && value >= BigInt("0");
}

function isSafeNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function createPaperAccountIntegrityService(
  unitOfWork: PaperAccountUnitOfWork,
): PaperAccountIntegrityService {
  return {
    async checkPaperAccountIntegrity(accountId) {
      assertAccountId(accountId);

      const readModel = await unitOfWork.run(async (context) => {
        const account = await context.accounts.findById(accountId);
        if (account === null) {
          throw new Error("PAPER_ACCOUNT_ACCOUNT_NOT_FOUND");
        }

        const settings = await context.settings.findLatestByScope(`account:${accountId}`);
        const ledger = await context.ledger.listByAccount(accountId);
        const positions = await context.positions.listByAccount(accountId);
        const fills = await context.fills.listByAccount(accountId);

        // Sort positions by code asc, then id asc
        const sortedPositions = [...positions].sort((a, b) => {
          const codeCmp = a.code.localeCompare(b.code);
          if (codeCmp !== 0) return codeCmp;
          return a.id.localeCompare(b.id);
        });

        // Load lots for each position
        const positionsWithLots = await Promise.all(
          sortedPositions.map(async (position) => {
            const lots = await context.lots.listByPosition(position.id);
            return { position, lots };
          }),
        );

        return { account, settings, ledger, fills, positionsWithLots };
      });

      const { account, settings, ledger, fills, positionsWithLots } = readModel;
      const issues: string[] = [];
      const seen = new Set<string>();

      // 1 ── Settings missing
      if (settings === null) {
        appends(issues, seen, "PAPER_ACCOUNT_SETTINGS_MISSING");
      }

      // 2 ── Ledger sequence check
      let expectedSequence = 1;
      let ledgerSequenceInvalid = false;
      for (const entry of ledger) {
        if (!Number.isSafeInteger(entry.sequence) || entry.sequence <= 0 || entry.sequence !== expectedSequence) {
          ledgerSequenceInvalid = true;
        }
        expectedSequence += 1;
      }
      if (ledgerSequenceInvalid) {
        appends(issues, seen, "PAPER_ACCOUNT_LEDGER_SEQUENCE_INVALID");
      }

      // 3-4 ── Ledger amount/balance
      let ledgerAmountInvalid = false;
      let ledgerBalanceMismatch = false;
      let ledgerCashFen = BigInt("0");

      for (const entry of ledger) {
        if (isBigIntNonNegative(entry.amountFen)) {
          if (entry.direction === ("credit" as CashLedgerDirection)) {
            ledgerCashFen = assertSqliteInt64(ledgerCashFen + entry.amountFen);
          } else {
            ledgerCashFen = assertSqliteInt64(ledgerCashFen - entry.amountFen);
          }
        } else {
          ledgerAmountInvalid = true;
        }

        if (
          typeof entry.balanceAfterFen !== "bigint" ||
          entry.balanceAfterFen !== ledgerCashFen
        ) {
          ledgerBalanceMismatch = true;
        }
      }

      if (ledgerAmountInvalid) {
        appends(issues, seen, "PAPER_ACCOUNT_LEDGER_AMOUNT_INVALID");
      }
      if (ledgerBalanceMismatch) {
        appends(issues, seen, "PAPER_ACCOUNT_LEDGER_BALANCE_MISMATCH");
      }

      // 5-7 ── Cash check
      if (account.availableCashFen < BigInt("0")) {
        appends(issues, seen, "PAPER_ACCOUNT_AVAILABLE_CASH_INVALID");
      }
      if (account.frozenCashFen < BigInt("0")) {
        appends(issues, seen, "PAPER_ACCOUNT_FROZEN_CASH_INVALID");
      }

      const cachedCashFen =
        account.availableCashFen + account.frozenCashFen;

      if (ledgerCashFen !== cachedCashFen) {
        appends(issues, seen, "CASH_CACHE_MISMATCH");
      }

      // 8-9 ── Fill fees
      let fillFeeInvalid = false;
      let calculatedFees = BigInt("0");

      for (const fill of fills) {
        for (const feeFen of [fill.commissionFen, fill.stampDutyFen, fill.transferFeeFen]) {
          if (isBigIntNonNegative(feeFen)) {
            calculatedFees = assertSqliteInt64(calculatedFees + feeFen);
          } else {
            fillFeeInvalid = true;
          }
        }
      }

      if (fillFeeInvalid) {
        appends(issues, seen, "PAPER_ACCOUNT_FILL_FEE_INVALID");
      }

      if (calculatedFees !== account.cumulativeFeesFen) {
        appends(issues, seen, "CUMULATIVE_FEES_MISMATCH");
      }

      // 10 ── Position and lot checks per code
      for (const { position, lots } of positionsWithLots) {
        const code = position.code;

        let posIssue = false;

        if (
          !isSafeNonNegativeInteger(position.totalQuantity) ||
          !isSafeNonNegativeInteger(position.sellableQuantity) ||
          !isSafeNonNegativeInteger(position.frozenQuantity)
        ) {
          posIssue = true;
        } else if (
          position.sellableQuantity > position.totalQuantity ||
          position.frozenQuantity > position.totalQuantity ||
          position.sellableQuantity + position.frozenQuantity > position.totalQuantity
        ) {
          posIssue = true;
        }

    if (posIssue) {
      appends(issues, seen, `PAPER_ACCOUNT_POSITION_QUANTITY_INVALID:${code}`);
    }

    // Lot checks
    let lotIssue = false;
    let sumRemaining = 0;
    let lotSumValid = true;

    for (const lot of lots) {
      const origOk = isSafeNonNegativeInteger(lot.originalQuantity);
      const remOk = isSafeNonNegativeInteger(lot.remainingQuantity);

      if (!origOk || !remOk) {
        lotIssue = true;
      } else if (lot.remainingQuantity > lot.originalQuantity) {
        lotIssue = true;
      }

      if (remOk) {
        const newSum = sumRemaining + lot.remainingQuantity;
        if (!Number.isSafeInteger(newSum) || newSum < 0) {
          lotSumValid = false;
        } else {
          sumRemaining = newSum;
        }
      }
    }

    if (lotIssue || !lotSumValid) {
      appends(issues, seen, `PAPER_ACCOUNT_LOT_QUANTITY_INVALID:${code}`);
    }

    // Mismatch only depends on totalQuantity validity, not other position field issues
    if (
      isSafeNonNegativeInteger(position.totalQuantity) &&
      lotSumValid &&
      sumRemaining !== position.totalQuantity
    ) {
      appends(issues, seen, `POSITION_LOT_QUANTITY_MISMATCH:${code}`);
    }
      }

      return {
        valid: issues.length === 0,
        issues,
        ledgerCashFen,
        cachedCashFen,
      };
    },
  };
}