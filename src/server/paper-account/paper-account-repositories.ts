import type {
  CashLedgerDirection,
  CashLedgerType,
  PaperAccountStatus,
  PaperOrderSide,
  PaperOrderStatus,
  PaperWorkerStatus,
} from "@prisma/client";

import type {
  BasisPoints,
  MoneyFen,
  PriceFen,
  RatePpm,
} from "@/lib/paper-account/paper-account-types";

export type PaperAccountRecord = {
  id: string;
  accountKey: string;
  initialCashFen: MoneyFen;
  availableCashFen: MoneyFen;
  frozenCashFen: MoneyFen;
  realizedPnlFen: MoneyFen;
  cumulativeFeesFen: MoneyFen;
  accountVersion: number;
  status: PaperAccountStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreatePaperAccountInput = {
  accountKey: string;
  initialCashFen: MoneyFen;
  status: PaperAccountStatus;
};

export type UpdatePaperAccountCashInput = {
  accountId: string;
  availableCashFen: MoneyFen;
  frozenCashFen: MoneyFen;
  realizedPnlFen?: MoneyFen;
  cumulativeFeesFen?: MoneyFen;
  expectedAccountVersion: number;
};

export type PaperAccountRepository = {
  findById(accountId: string): Promise<PaperAccountRecord | null>;
  findByKey(accountKey: string): Promise<PaperAccountRecord | null>;
  create(input: CreatePaperAccountInput): Promise<PaperAccountRecord>;
  updateCash(input: UpdatePaperAccountCashInput): Promise<PaperAccountRecord>;
};

export type PaperAccountSettingsVersionRecord = {
  id: string;
  scopeKey: string;
  accountId: string | null;
  version: number;
  initialCashForNewAccountsFen: MoneyFen | null;
  commissionRatePpm: RatePpm;
  minimumCommissionFen: MoneyFen;
  stampDutySellRatePpm: RatePpm;
  transferFeeRatePpm: RatePpm;
  maxSingleStockBp: BasisPoints;
  maxTotalPositionBp: BasisPoints;
  maxRiskBp: BasisPoints;
  actorId: string;
  idempotencyKey: string | null;
  createdAt: string;
};

export type PaperAccountSettingsVersionInput = {
  scopeKey: string;
  accountId: string | null;
  version: number;
  initialCashForNewAccountsFen: MoneyFen | null;
  commissionRatePpm: RatePpm;
  minimumCommissionFen: MoneyFen;
  stampDutySellRatePpm: RatePpm;
  transferFeeRatePpm: RatePpm;
  maxSingleStockBp: BasisPoints;
  maxTotalPositionBp: BasisPoints;
  maxRiskBp: BasisPoints;
  actorId: string;
  occurredAt: string;
  idempotencyKey: string;
};

export type PaperAccountSettingsRepository = {
  findLatestByScope(
    scopeKey: string,
  ): Promise<PaperAccountSettingsVersionRecord | null>;
  listByScope(scopeKey: string): Promise<PaperAccountSettingsVersionRecord[]>;
  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<PaperAccountSettingsVersionRecord | null>;
  append(
    input: PaperAccountSettingsVersionInput,
  ): Promise<PaperAccountSettingsVersionRecord>;
};

export type PaperPositionRecord = {
  id: string;
  accountId: string;
  code: string;
  totalQuantity: number;
  sellableQuantity: number;
  frozenQuantity: number;
  averageCostFen: PriceFen;
  realizedPnlFen: MoneyFen;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreatePaperPositionInput = {
  accountId: string;
  code: string;
  totalQuantity: number;
  sellableQuantity: number;
  frozenQuantity: number;
  averageCostFen: PriceFen;
  realizedPnlFen: MoneyFen;
};

export type UpdatePaperPositionInput = {
  positionId: string;
  totalQuantity: number;
  sellableQuantity: number;
  frozenQuantity: number;
  averageCostFen: PriceFen;
  realizedPnlFen: MoneyFen;
  expectedVersion: number;
};

export type PaperPositionRepository = {
  findByAccountAndCode(
    accountId: string,
    code: string,
  ): Promise<PaperPositionRecord | null>;
  listByAccount(accountId: string): Promise<PaperPositionRecord[]>;
  create(input: CreatePaperPositionInput): Promise<PaperPositionRecord>;
  updateWithVersion(
    input: UpdatePaperPositionInput,
  ): Promise<PaperPositionRecord>;
};

export type PaperLotRecord = {
  id: string;
  positionId: string;
  acquiredSequence: number;
  acquiredTradingDate: string;
  sellableTradingDate: string;
  originalQuantity: number;
  remainingQuantity: number;
  priceFen: PriceFen;
  buyFeeFen: MoneyFen;
  createdAt: string;
};

export type CreatePaperLotInput = {
  positionId: string;
  acquiredSequence: number;
  acquiredTradingDate: string;
  sellableTradingDate: string;
  originalQuantity: number;
  remainingQuantity: number;
  priceFen: PriceFen;
  buyFeeFen: MoneyFen;
};

export type PaperLotRepository = {
  listByPosition(positionId: string): Promise<PaperLotRecord[]>;
  listSellableByPosition(
    positionId: string,
    tradingDate: string,
  ): Promise<PaperLotRecord[]>;
  append(input: CreatePaperLotInput): Promise<PaperLotRecord>;
  updateRemainingQuantity(input: {
    lotId: string;
    remainingQuantity: number;
    expectedRemainingQuantity: number;
  }): Promise<PaperLotRecord>;
};

export type PaperOrderRecord = {
  id: string;
  accountId: string;
  positionId: string | null;
  code: string;
  side: PaperOrderSide;
  quantity: number;
  priceFen: PriceFen | null;
  status: PaperOrderStatus;
  riskSnapshotJson: string;
  settingsVersion: number;
  idempotencyKey: string | null;
  version: number;
  confirmedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePaperOrderInput = {
  accountId: string;
  positionId: string | null;
  code: string;
  side: PaperOrderSide;
  quantity: number;
  priceFen: PriceFen | null;
  status: PaperOrderStatus;
  riskSnapshotJson: string;
  settingsVersion: number;
  idempotencyKey: string;
  confirmedAt: string | null;
  completedAt: string | null;
};

export type UpdatePaperOrderStatusInput = {
  orderId: string;
  fromStatus: PaperOrderStatus;
  toStatus: PaperOrderStatus;
  expectedVersion: number;
  confirmedAt?: string | null;
  completedAt?: string | null;
};

export type PaperOrderRepository = {
  findById(orderId: string): Promise<PaperOrderRecord | null>;
  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<PaperOrderRecord | null>;
  listByAccount(accountId: string): Promise<PaperOrderRecord[]>;
  append(input: CreatePaperOrderInput): Promise<PaperOrderRecord>;
  updateStatusWithVersion(
    input: UpdatePaperOrderStatusInput,
  ): Promise<PaperOrderRecord>;
};

export type PaperFillRecord = {
  id: string;
  orderId: string;
  sequence: number;
  quantity: number;
  priceFen: PriceFen;
  notionalFen: MoneyFen;
  commissionFen: MoneyFen;
  stampDutyFen: MoneyFen;
  transferFeeFen: MoneyFen;
  tradingDate: string;
  executedAt: string;
  createdAt: string;
};

export type CreatePaperFillInput = {
  orderId: string;
  sequence: number;
  quantity: number;
  priceFen: PriceFen;
  notionalFen: MoneyFen;
  commissionFen: MoneyFen;
  stampDutyFen: MoneyFen;
  transferFeeFen: MoneyFen;
  tradingDate: string;
  executedAt: string;
};

export type PaperFillRepository = {
  findByOrderAndSequence(
    orderId: string,
    sequence: number,
  ): Promise<PaperFillRecord | null>;
  listByOrder(orderId: string): Promise<PaperFillRecord[]>;
  listByAccount(accountId: string): Promise<PaperFillRecord[]>;
  append(input: CreatePaperFillInput): Promise<PaperFillRecord>;
};

export type CashLedgerEntryRecord = {
  id: string;
  accountId: string;
  orderId: string | null;
  sequence: number;
  direction: CashLedgerDirection;
  type: CashLedgerType;
  amountFen: MoneyFen;
  balanceAfterFen: MoneyFen;
  idempotencyKey: string | null;
  metadataJson: string | null;
  occurredAt: string;
  createdAt: string;
};

export type CashLedgerEntryInput = {
  accountId: string;
  orderId: string | null;
  sequence: number;
  direction: CashLedgerDirection;
  type: CashLedgerType;
  amountFen: MoneyFen;
  balanceAfterFen: MoneyFen;
  idempotencyKey: string;
  metadataJson: string | null;
  occurredAt: string;
};

export type CashLedgerRepository = {
  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<CashLedgerEntryRecord | null>;
  listByAccount(accountId: string): Promise<CashLedgerEntryRecord[]>;
  sumByAccount(accountId: string): Promise<{
    creditsFen: MoneyFen;
    debitsFen: MoneyFen;
    netFen: bigint;
  }>;
  append(input: CashLedgerEntryInput): Promise<CashLedgerEntryRecord>;
};

export type ExitRuleRecord = {
  id: string;
  positionId: string;
  version: number;
  settingsVersion: number;
  firstTargetPriceFen: PriceFen;
  secondTargetPriceFen: PriceFen;
  stopPriceFen: PriceFen;
  firstTargetExecutedAt: string | null;
  secondTargetExecutedAt: string | null;
  isActive: boolean;
  actorId: string;
  idempotencyKey: string | null;
  confirmedAt: string;
  supersededAt: string | null;
  createdAt: string;
};

export type CreateExitRuleInput = {
  positionId: string;
  version: number;
  settingsVersion: number;
  firstTargetPriceFen: PriceFen;
  secondTargetPriceFen: PriceFen;
  stopPriceFen: PriceFen;
  actorId: string;
  idempotencyKey: string;
  confirmedAt: string;
};

export type ExitRuleRepository = {
  findActiveByPosition(positionId: string): Promise<ExitRuleRecord | null>;
  listByPosition(positionId: string): Promise<ExitRuleRecord[]>;
  append(input: CreateExitRuleInput): Promise<ExitRuleRecord>;
  supersede(input: {
    ruleId: string;
    expectedVersion: number;
    supersededAt: string;
  }): Promise<ExitRuleRecord>;
};

export type PaperAuditLogRecord = {
  id: string;
  accountId: string;
  sequence: number;
  action: string;
  actorId: string;
  entityType: string;
  entityId: string | null;
  payloadJson: string;
  idempotencyKey: string | null;
  occurredAt: string;
  createdAt: string;
};

export type PaperAuditLogInput = {
  accountId: string;
  sequence: number;
  action: string;
  actorId: string;
  entityType: string;
  entityId: string | null;
  payloadJson: string;
  idempotencyKey: string;
  occurredAt: string;
};

export type PaperAuditRepository = {
  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<PaperAuditLogRecord | null>;
  listByAccount(accountId: string): Promise<PaperAuditLogRecord[]>;
  append(input: PaperAuditLogInput): Promise<PaperAuditLogRecord>;
};

export type PaperWorkerStateRecord = {
  id: string;
  accountId: string;
  code: string;
  status: PaperWorkerStatus;
  lastProcessedMinuteAt: string | null;
  lastSuccessfulCheckAt: string | null;
  lastErrorCode: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type UpsertPaperWorkerStateInput = {
  accountId: string;
  code: string;
  status: PaperWorkerStatus;
  lastProcessedMinuteAt: string | null;
  lastSuccessfulCheckAt: string | null;
  lastErrorCode: string | null;
  expectedVersion: number | null;
};

export type PaperWorkerStateRepository = {
  findByAccountAndCode(
    accountId: string,
    code: string,
  ): Promise<PaperWorkerStateRecord | null>;
  listByAccount(accountId: string): Promise<PaperWorkerStateRecord[]>;
  upsertWithVersion(
    input: UpsertPaperWorkerStateInput,
  ): Promise<PaperWorkerStateRecord>;
};

export type WorkerLeaseRecord = {
  id: string;
  leaseKey: string;
  ownerId: string;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AcquireWorkerLeaseInput = {
  leaseKey: string;
  ownerId: string;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
};

export type WorkerLeaseRepository = {
  findByKey(leaseKey: string): Promise<WorkerLeaseRecord | null>;
  acquire(input: AcquireWorkerLeaseInput): Promise<WorkerLeaseRecord>;
  heartbeat(input: {
    leaseKey: string;
    ownerId: string;
    expectedVersion: number;
    heartbeatAt: string;
    expiresAt: string;
  }): Promise<WorkerLeaseRecord>;
  release(input: {
    leaseKey: string;
    ownerId: string;
    expectedVersion: number;
    releasedAt: string;
  }): Promise<WorkerLeaseRecord>;
};
