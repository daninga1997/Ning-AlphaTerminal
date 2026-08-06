import type {
  CashLedgerRepository,
  ExitRuleRepository,
  PaperAccountRepository,
  PaperAccountSettingsRepository,
  PaperAuditRepository,
  PaperFillRepository,
  PaperLotRepository,
  PaperOrderRepository,
  PaperPositionRepository,
  PaperWorkerStateRepository,
  WorkerLeaseRepository,
} from "./paper-account-repositories";

export type PaperAccountTransactionContext = {
  accounts: PaperAccountRepository;
  settings: PaperAccountSettingsRepository;
  positions: PaperPositionRepository;
  lots: PaperLotRepository;
  orders: PaperOrderRepository;
  fills: PaperFillRepository;
  ledger: CashLedgerRepository;
  exitRules: ExitRuleRepository;
  audit: PaperAuditRepository;
  workerStates: PaperWorkerStateRepository;
  leases: WorkerLeaseRepository;
};

export type PaperAccountUnitOfWork = {
  run<T>(
    work: (context: PaperAccountTransactionContext) => Promise<T>,
  ): Promise<T>;
};
