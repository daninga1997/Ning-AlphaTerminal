# Paper Account Ledger Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立具备精确金额计算、不可变资金账本、版本化设置和事务一致性的模拟账户底座。

**Architecture:** 使用 Prisma/SQLite 持久化账户、设置版本、持仓、批次、订单、成交、流水、退出规则、审计、Worker 状态和租约；金额、价格、费用、成本和盈亏均以整数最小单位保存。领域计算位于纯函数模块，持久化写入经由共享事务上下文和 Repository 接口完成；本阶段不创建订单确认、退出 Worker、页面或 MCP。

**Tech Stack:** Next.js 16、TypeScript 5、Prisma 6、SQLite、Vitest 4。

## Global Constraints

- 旧 `PaperTrade`、旧 Prisma 迁移、旧 API 和旧页面保持只读兼容；不得迁移、删除或继续写入旧 `PaperTrade`。
- 新账户默认初始资金为 `10,000,000` 分（100,000.00 元）；修改默认初始资金只影响未来新账户。
- 已有账户不得直接改写初始资金；入金、出金和资金更正只写不可变 `CashLedgerEntry`，并记录原因、操作者、时间与审计日志。
- 佣金双向 `250` ppm（0.025%），单笔最低 `500` 分；卖出印花税 `500` ppm（0.05%）；过户费双向 `10` ppm（0.001%）。
- 单股仓位上限 `3,000` bp（30%）、总仓位上限 `8,000` bp（80%）、单笔风险上限 `200` bp（2%）。
- 账本真实值不得使用 `Float` 或 TypeScript `number`；所有现金、价格、成交额、成本、费用和盈亏字段使用 Prisma `BigInt` 与领域 `bigint`。
- 费率使用 ppm，仓位/风险使用 bp，金额与价格使用分；所有乘除均使用确定性的整数舍入函数。
- 数据库测试使用系统临时目录中独立 SQLite 文件；禁止执行 `prisma migrate reset`，禁止重置或污染 `.env` 指向的开发数据库。
- 所有新写入都必须经 `PaperTradingCommandService` 的后续组合根；本阶段只建立其依赖的 Repository、事务和初始化服务，不开放命令 API。
- 不实现开仓、加仓、减仓、平仓、订单确认、止盈止损 Worker、页面、MCP、券商接口或真实行情调用。

---

## File Map

| 路径                                           | 职责                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/paper-account/money.ts`               | 整数金额、价格、费率、仓位比例和舍入。                                 |
| `src/lib/paper-account/fee-calculator.ts`      | 买卖佣金、印花税、过户费明细。                                         |
| `src/lib/paper-account/risk-sizing.ts`         | 2%、30%、80% 三类仓位约束与整手取整。                                  |
| `src/lib/paper-account/position-cost.ts`       | 多批次买入后的含费加权成本。                                           |
| `src/lib/paper-account/lot-allocation.ts`      | FIFO 批次扣减计划。                                                    |
| `src/lib/paper-account/break-even-stop.ts`     | 第一目标后包含未来卖出费用的保本价。                                   |
| `src/lib/paper-account/t1-calendar.ts`         | 下一可卖交易日的纯接口与校验。                                         |
| `src/lib/paper-account/paper-account-types.ts` | 前述纯函数共享的领域标量、输入和结果类型。                             |
| `src/server/paper-account/*`                   | 新账户账本的持久化、事务、初始化、设置、调整、快照和一致性服务。       |
| `prisma/schema.prisma` 与新增迁移              | 新账本数据模型；不改动旧 `PaperTrade`。                                |
| `scripts/run-paper-account-db-tests.mjs`       | 创建临时测试 SQLite 数据库、部署迁移、运行指定集成测试并删除临时目录。 |

## 数据表示与舍入规则

- `MoneyFen` 与 `PriceFen` 使用 `bigint`；账本金额字段始终存绝对值，借贷方向由枚举表达，不以负数混入金额列。
- `RatePpm` 的分母为 `1_000_000`；`250`、`500`、`10` 分别代表 0.025%、0.05%、0.001%。
- `BasisPoints` 的分母为 `10_000`；`3_000`、`8_000`、`200` 分别代表 30%、80%、2%。
- 费用和金额比例计算采用非负整数的“四舍五入到最接近分，恰好半分向上”；仓位股数采用向下取整到 100 股。
- 所有 `quantity × priceFen`、`moneyFen × ratePpm` 和累加结果保持为 `bigint`，并在写入前校验 SQLite 有符号 64 位范围；超界时抛出 `PAPER_ACCOUNT_BIGINT_OUT_OF_RANGE`。
- Prisma `BigInt` 读取后保持为 `bigint`；数据库映射层不把金额转换成 `number`。页面、API 和未来 MCP 只接收十进制字符串，不能自行用浮点重算账本。

## Conversion Boundaries

- Prisma 直接创建模型的 `occurredAt` 一律传入 `Date`；Repository 领域输入的 `occurredAt` 一律传入 ISO 8601 `string`。Prisma Repository 映射层负责把该字符串转换为 `Date`，同一个 Repository 接口不得混用 `Date` 与 `string`。
- Prisma 映射层从数据库 `BigInt` 读取 `*Fen` 字段并保持 `bigint`，从数据库 `Int` 读取 ppm、bp、数量和版本字段并验证为安全非负 `number`。Prisma 模型不会直接泄漏给页面。
- 领域层接收 `MoneyFen`、`PriceFen`、`RatePpm`、`BasisPoints` 和数量，返回同样的整数值及明确状态；领域函数不导入 Prisma Client、不访问环境变量。
- `bigint` 不能直接传给 `JSON.stringify`。查询层的 `PaperAccountSnapshot` 保持分值为 `bigint`，其 API/MCP 展示 DTO 通过 `toDecimalString(value: bigint): string` 和 `formatFen(value: bigint): string` 转成字符串；接收十进制字符串时只通过 `parseFen(value: string): bigint` 解析。页面未来只能消费展示 DTO，不能从 `PaperAccount`、`CashLedgerEntry` 或 `PaperFill` 重建余额。
- 费率在持久化与领域层始终为 ppm，仓位限制始终为 bp；展示层可将其格式化为百分比文本，但不得将格式化文本回写账本。

## Persistent Contract

| 模型 | 必填核心字段 | 唯一键与索引 | 删除策略 |
| --- | --- | --- | --- |
| `PaperAccount` | `accountKey`、`initialCashFen`、`availableCashFen`、`frozenCashFen`、`realizedPnlFen`、`cumulativeFeesFen`（均为 Prisma `BigInt`）、`accountVersion`、`status` | `accountKey` 唯一；`status` 索引 | 不允许删除存在任何账本记录的账户。 |
| `PaperAccountSettingsVersion` | `scopeKey`、`version`、佣金/税费 ppm、`minimumCommissionFen`（Prisma `BigInt`）、三个 bp 上限、`actorId`、`occurredAt`、`idempotencyKey`；仅 `new-account-default` 范围可写 `initialCashForNewAccountsFen`（Prisma `BigInt`） | `[scopeKey, version]` 唯一；`idempotencyKey` 唯一；`accountId` 索引 | 历史版本不删除。 |
| `PaperPosition` | `accountId`、`code`、`totalQuantity`、`sellableQuantity`、`frozenQuantity`、`averageCostFen`、`realizedPnlFen`（金额均为 Prisma `BigInt`）、`version` | `[accountId, code]` 唯一 | 零仓位保留，不删除。 |
| `PaperLot` | `positionId`、`acquiredSequence`、`originalQuantity`、`remainingQuantity`、`priceFen`、`buyFeeFen`（金额均为 Prisma `BigInt`）、`sellableTradingDate` | `[positionId, acquiredSequence]` 唯一；`[positionId, sellableTradingDate]` 索引 | 不删除，剩余数量归零后保留。 |
| `PaperOrder` | `accountId`、`positionId?`、`type`、`side`、`status`、`quantity`、`priceFen?`（Prisma `BigInt`）、`version`、`idempotencyKey`、`riskSnapshotJson` | `idempotencyKey` 唯一；`[accountId, status]` 索引 | 不删除。 |
| `PaperFill` | `orderId`、`sequence`、`quantity`、`priceFen`、`notionalFen`、`commissionFen`、`stampDutyFen`、`transferFeeFen`（均为 Prisma `BigInt`）、`executedAt` | `[orderId, sequence]` 唯一 | 不删除，成交后价格、数量和费用不更新。 |
| `CashLedgerEntry` | `accountId`、`sequence`、`type`、`direction`、`amountFen`（Prisma `BigInt`）、`occurredAt`、`reason`、`actorId`、`idempotencyKey?` | `[accountId, sequence]` 唯一；非空 `idempotencyKey` 唯一；`[accountId, occurredAt]` 索引 | 不删除，只能追加。 |
| `ExitRule` | `positionId`、`version`、`firstTargetPriceFen`、`secondTargetPriceFen`、`stopPriceFen`（均为 Prisma `BigInt`）、`status`、`settingsVersion` | `[positionId, version]` 唯一 | 不删除，旧规则标记废止。 |
| `PaperAuditLog` | `accountId`、`sequence`、`eventType`、`actorId`、`occurredAt`、`payloadJson`、`idempotencyKey?` | `[accountId, sequence]` 唯一；非空 `idempotencyKey` 唯一；`[accountId, occurredAt]` 索引 | 不删除，只能追加。 |
| `PaperWorkerState` | `accountId`、`code`、`lastProcessedMinuteAt?`、`lastSuccessfulCheckAt?`、`status`、`version` | `[accountId, code]` 唯一 | 不删除。 |
| `WorkerLease` | `leaseKey`、`workerId`、`acquiredAt`、`heartbeatAt`、`expiresAt`、`version` | `leaseKey` 唯一；`expiresAt` 索引 | 租约到期后可被安全接管；不物理删除历史状态。 |

所有账户历史关联使用 `onDelete: Restrict`。`WorkerLease` 不与 `PaperWorkerState` 合并：租约需要每 10 秒写一次心跳、45 秒后接管，而状态行按账户和股票保存分钟游标；分离可避免心跳写入覆盖游标版本。

### Task 1: 金额、费率与领域基础类型

**Files:**

- Create: `src/lib/paper-account/paper-account-types.ts`
- Create: `src/lib/paper-account/money.ts`
- Test: `src/lib/paper-account/money.test.ts`

**Interfaces:**

- Consumes: 无。
- Produces: `MoneyFen`、`PriceFen`、`RatePpm`、`BasisPoints`、`BoardLotQuantity`、`assertNonNegativeBigInt(value: bigint, code: string): bigint`、`assertSafeNonNegativeInteger(value: number, code: string): number`、`roundHalfUp(numerator: bigint, denominator: bigint): bigint`、`multiplyByRatePpm(amountFen: bigint, ratePpm: number): bigint`、`roundDownToBoardLot(quantity: number): BoardLotQuantity`、`formatFen(amountFen: bigint): string`、`parseFen(value: string): bigint`、`toDecimalString(value: bigint): string`。
- 后续依赖：所有领域计算、Repository DTO 和服务只使用这些标量类型表示账本金额、价格和费率。

- [x] **Step 1: 写入失败的金额与舍入测试。**

```ts
import { describe, expect, it } from "vitest";
import {
  formatFen,
  multiplyByRatePpm,
  parseFen,
  roundDownToBoardLot,
  roundHalfUp,
} from "./money";

describe("money", () => {
  it("rounds a fee half up to the nearest fen", () => {
    expect(multiplyByRatePpm(10_001n, 250)).toBe(3n);
  });

  it("rounds an exact half upward", () => {
    expect(roundHalfUp(5n, 2n)).toBe(3n);
  });

  it("rounds below half downward with an odd denominator", () => {
    expect(roundHalfUp(4n, 3n)).toBe(1n);
  });

  it("rounds above half upward with an odd denominator", () => {
    expect(roundHalfUp(5n, 3n)).toBe(2n);
  });

  it("rejects a zero denominator", () => {
    expect(() => roundHalfUp(1n, 0n))
      .toThrow("ROUND_DENOMINATOR_MUST_BE_POSITIVE");
  });

  it("rejects a negative numerator", () => {
    expect(() => roundHalfUp(-1n, 2n))
      .toThrow("ROUND_NUMERATOR_MUST_BE_NON_NEGATIVE");
  });

  it("formats and parses a non-negative fen amount", () => {
    expect(formatFen(500n)).toBe("5.00");
    expect(parseFen("500")).toBe(500n);
  });

  it("rounds quantities down to a 100-share board lot", () => {
    expect(roundDownToBoardLot(299)).toBe(200);
  });
});
```

- [x] **Step 2: 运行目标测试并确认失败。**

Run: `npx vitest run src/lib/paper-account/money.test.ts`  
Expected: FAIL，因为 `./money`、`multiplyByRatePpm` 和 `roundDownToBoardLot` 尚不存在。

- [x] **Step 3: 创建标量类型和最小整数工具。**

```ts
export type MoneyFen = bigint;
export type PriceFen = bigint;
export type RatePpm = number;
export type BasisPoints = number;
export type BoardLotQuantity = number;

export function assertNonNegativeBigInt(value: bigint, code: string): bigint {
  if (value < 0n) throw new Error(code);
  return value;
}

export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n) {
    throw new Error("ROUND_NUMERATOR_MUST_BE_NON_NEGATIVE");
  }

  if (denominator <= 0n) {
    throw new Error("ROUND_DENOMINATOR_MUST_BE_POSITIVE");
  }

  const quotient = numerator / denominator;
  const remainder = numerator % denominator;

  return remainder * 2n >= denominator
    ? quotient + 1n
    : quotient;
}

export function multiplyByRatePpm(amountFen: bigint, ratePpm: number): bigint {
  return roundHalfUp(amountFen * BigInt(ratePpm), 1_000_000n);
}

export function roundDownToBoardLot(quantity: number): BoardLotQuantity {
  return Math.floor(quantity / 100) * 100;
}
```

实现 `assertSafeNonNegativeInteger`、`parseFen`、`toDecimalString`、`formatFen` 与 SQLite 有符号 64 位范围校验。`parseFen` 只接受十进制非负整数字符串；负数费率、非整数数量、除数小于 `1n`、超出 SQLite `BigInt` 范围和非十进制金额均抛出固定错误码。

- [x] **Step 4: 扩展目标测试并运行通过。**

测试 SQLite 有符号 64 位上界外的金额被拒绝、`500n` 分格式化为 `5.00`、`parseFen("500")` 返回 `500n`、非十进制字符串被拒绝、`10` ppm 与 `250` ppm 的比例计算，以及 `0` 股与 `100` 股的整手结果。`roundHalfUp` 另行覆盖恰好半分向上、低于半分向下、高于半分向上、负 `numerator` 抛出 `ROUND_NUMERATOR_MUST_BE_NON_NEGATIVE`，以及零或负 `denominator` 抛出 `ROUND_DENOMINATOR_MUST_BE_POSITIVE`；本系统比例金额只接受非负 `bigint`。

Run: `npx vitest run src/lib/paper-account/money.test.ts`  
Expected: PASS，金额和价格结果均保持为 `bigint`，费率与数量均为已校验的 `number`。

- [x] **Step 5: 提交独立基础类型变更。**

```bash
git add src/lib/paper-account/paper-account-types.ts src/lib/paper-account/money.ts src/lib/paper-account/money.test.ts
git commit -m "feat: add paper account money primitives"
```

### Task 2: 费用计算与费用明细

**Files:**

- Create: `src/lib/paper-account/fee-calculator.ts`
- Test: `src/lib/paper-account/fee-calculator.test.ts`

**Interfaces:**

- Consumes: `MoneyFen`、`PriceFen`、`RatePpm`、`multiplyByRatePpm`、`assertNonNegativeBigInt`、`assertSafeNonNegativeInteger`。
- Produces: `FeeSchedule`、`TradeSide`、`TradeFeeBreakdown`、`calculateTradeFees(input: CalculateTradeFeesInput): TradeFeeBreakdown`。
- `CalculateTradeFeesInput`: `{ side: "buy" | "sell"; quantity: number; priceFen: PriceFen; schedule: FeeSchedule }`。
- `FeeSchedule`: `{ commissionRatePpm: RatePpm; minimumCommissionFen: MoneyFen; stampDutySellRatePpm: RatePpm; transferFeeRatePpm: RatePpm }`。
- `TradeFeeBreakdown`: `{ notionalFen: MoneyFen; commissionFen: MoneyFen; stampDutyFen: MoneyFen; transferFeeFen: MoneyFen; totalFeeFen: MoneyFen }`。

- [x] **Step 1: 写入失败的费用测试。**

```ts
const defaultSchedule = {
  commissionRatePpm: 250,
    minimumCommissionFen: 500n,
  stampDutySellRatePpm: 500,
  transferFeeRatePpm: 10,
};

it("charges the 5-yuan commission minimum on a small buy", () => {
  expect(
    calculateTradeFees({ side: "buy", quantity: 100, priceFen: 1_000n, schedule: defaultSchedule })
      .commissionFen,
  ).toBe(500n);
});

it("charges stamp duty only when selling", () => {
  expect(
    calculateTradeFees({ side: "buy", quantity: 1_000, priceFen: 1_000n, schedule: defaultSchedule })
      .stampDutyFen,
  ).toBe(0n);
  expect(
    calculateTradeFees({
      side: "sell",
      quantity: 1_000,
      priceFen: 1_000n,
      schedule: defaultSchedule,
    }).stampDutyFen,
  ).toBe(500n);
});
```

- [x] **Step 2: 运行目标测试并确认失败。**

Run: `npx vitest run src/lib/paper-account/fee-calculator.test.ts`  
Expected: FAIL，因为 `calculateTradeFees` 尚不存在。

- [x] **Step 3: 实现唯一的费用计算器。**

`calculateTradeFees` 先以 `BigInt(quantity) × priceFen` 计算 `notionalFen`，佣金取比例费用与 `minimumCommissionFen` 的较大值；买入印花税固定为 `0n`，卖出按 `stampDutySellRatePpm` 计算；过户费双向计算；总费用为三项之和。所有金额字段保持 `bigint`，数量与费率在转换前验证为安全非负 `number`。

- [x] **Step 4: 运行完整费用测试。**

补充佣金比例高于最低值、双向过户费、金额半分向上舍入、零数量拒绝与默认费率常量测试。

Run: `npx vitest run src/lib/paper-account/fee-calculator.test.ts`  
Expected: PASS，买入不收印花税，卖出收印花税，过户费双向收取。

- [x] **Step 5: 提交费用模块。**

```bash
git add src/lib/paper-account/fee-calculator.ts src/lib/paper-account/fee-calculator.test.ts
git commit -m "feat: add paper account fee calculator"
```

### Task 3: 风险仓位计算

**Files:**

- Create: `src/lib/paper-account/risk-sizing.ts`
- Test: `src/lib/paper-account/risk-sizing.test.ts`

**Interfaces:**

- Consumes: Task 1 的金额与整手函数、Task 2 的 `FeeSchedule` 与 `calculateTradeFees`。
- Produces: `PlannedLossResult`、`RiskExceptionPlan`、`RiskSizingInput`、`RiskSizingResult`、`calculatePlannedLoss(input): PlannedLossResult`、`calculateRiskSizing(input: RiskSizingInput): RiskSizingResult`。
- `RiskSizingInput`: `{ equityFen: MoneyFen; availableCashFen: MoneyFen; existingStockMarketValueFen: MoneyFen; existingTotalMarketValueFen: MoneyFen; buyPriceFen: PriceFen; stopPriceFen: PriceFen; schedule: FeeSchedule; maxSingleStockBp: BasisPoints; maxTotalPositionBp: BasisPoints; maxRiskBp: BasisPoints }`。
- `calculatePlannedLoss(input: { quantity: BoardLotQuantity; buyPriceFen: PriceFen; stopPriceFen: PriceFen; schedule: FeeSchedule }): PlannedLossResult`。
- `PlannedLossResult`: `{ buyNotionalFen: MoneyFen; buyFeesFen: MoneyFen; stopSellNotionalFen: MoneyFen; stopSellFeesFen: MoneyFen; plannedLossFen: MoneyFen }`。
- `RiskExceptionPlan`: `{ quantity: 100; plannedLossFen: MoneyFen; actualRiskBp: BasisPoints; exceededRiskBp: BasisPoints }`。
- `RiskSizingResult`: `{ riskQuantity: number; singleStockQuantity: number; totalPositionQuantity: number; cashQuantity: number; selectedQuantity: BoardLotQuantity; limitingConstraint: "risk" | "single_stock" | "total_position" | "cash" | "board_lot" | "none"; riskExceptionRequired: boolean; riskExceptionPlan: RiskExceptionPlan | null }`。

- [x] **Step 1: 写入失败的三约束测试。**

```ts
it("selects the smallest board-lot quantity across risk, single-stock, and total-position limits", () => {
  const result = calculateRiskSizing({
    equityFen: 10_000_000n,
    availableCashFen: 10_000_000n,
    existingStockMarketValueFen: 0n,
    existingTotalMarketValueFen: 7_900_000n,
    buyPriceFen: 1_000n,
    stopPriceFen: 900n,
    schedule: defaultSchedule,
    maxSingleStockBp: 3_000,
    maxTotalPositionBp: 8_000,
    maxRiskBp: 200,
  });
  expect(result.limitingConstraint).toBe("total_position");
  expect(result.selectedQuantity % 100).toBe(0);
});
```

- [x] **Step 2: 运行目标测试并确认失败。**

Run: `npx vitest run src/lib/paper-account/risk-sizing.test.ts`  
Expected: FAIL，因为 `calculateRiskSizing` 尚不存在。

- [x] **Step 3: 实现完整费用驱动的风险搜索。**

`calculatePlannedLoss` 必须对给定整手数量分别调用完整的 `calculateTradeFees`：买入成交额与买入费用、止损价卖出成交额与卖出费用；`plannedLossFen = buyNotionalFen + buyFeesFen - stopSellNotionalFen + stopSellFeesFen`。它不得把最低佣金按每股分摊。

`calculateRiskSizing` 先以单股 30% 市值上限、总仓位 80% 剩余额度和 `availableCashFen` 分别求出候选数量；可用现金候选数量通过整手二分搜索，逐次调用完整买入费用计算，保证成交额加买入费用不超过可用现金。三个候选数量取最小值并向下取整至 100 股，得到最大候选整手。随后对该候选整手调用 `calculatePlannedLoss`，比较 `plannedLossFen` 与 `equityFen × maxRiskBp / 10_000`。若不满足 2% 风险限制，以 100 股为单位向下二分搜索；二分搜索结果必须再次调用完整 `calculatePlannedLoss` 验证后才返回。

只有当 100 股满足单股上限、总仓位上限和可用现金限制，但其 `plannedLossFen` 超过 2% 风险上限时，`riskExceptionRequired` 才能为 `true`；此时返回 `riskExceptionPlan`，其 `actualRiskBp` 用向上取整的 `plannedLossFen × 10_000 / equityFen` 计算，`exceededRiskBp` 为超出 `maxRiskBp` 的正差。本阶段只计算该计划，不创建确认或例外订单。

- [x] **Step 4: 运行完整风险测试。**

覆盖完整买入/止损卖出费用下的计划亏损、2% 风险限制、30% 单股限制、80% 总仓位限制、现金限制、四类候选值最小选择、100 股向下取整、止损不低于买入价拒绝、二分搜索最终复核、风险例外条件和 `actualRiskBp`/`exceededRiskBp`。所有金额断言使用 `n` 后缀，例如 `expect(result.plannedLossFen).toBe(12_345n)`。

Run: `npx vitest run src/lib/paper-account/risk-sizing.test.ts`  
Expected: PASS，所有金额均为 `bigint`，最终数量同时满足风险、单股、总仓位和现金限制；例外计划只在 100 股违反风险限制但满足其余三项限制时输出。

- [x] **Step 5: 提交风险计算模块。**

```bash
git add src/lib/paper-account/risk-sizing.ts src/lib/paper-account/risk-sizing.test.ts
git commit -m "feat: add paper account risk sizing"
```

### Task 4: 成本、FIFO、保本止损与 T+1 日历接口

**Files:**

- Create: `src/lib/paper-account/position-cost.ts`
- Create: `src/lib/paper-account/lot-allocation.ts`
- Create: `src/lib/paper-account/break-even-stop.ts`
- Create: `src/lib/paper-account/t1-calendar.ts`
- Test: `src/lib/paper-account/position-cost.test.ts`
- Test: `src/lib/paper-account/lot-allocation.test.ts`
- Test: `src/lib/paper-account/break-even-stop.test.ts`
- Test: `src/lib/paper-account/t1-calendar.test.ts`

**Interfaces:**

- Consumes: Task 1 的整数类型与 Task 2 的 `calculateTradeFees`。
- Produces: `calculateWeightedPositionCost(lots: CostLot[]): WeightedPositionCost`、`allocateLotsFifo(lots: AvailableLot[], quantity: number): LotAllocationResult`、`calculateBreakEvenStop(input: BreakEvenStopInput): PriceFen`、`TradingDayCalendar`、`getNextSellableTradingDay(input: T1CalendarInput): string`。
- `CostLot`: `{ quantity: number; priceFen: PriceFen; buyFeeFen: MoneyFen }`。
- `AvailableLot`: `{ lotId: string; acquiredSequence: number; remainingQuantity: number }`。
- `TradingDayCalendar`: `{ nextTradingDay(afterTradingDate: string): string | null }`，真实交易日历实现留给后续市场数据阶段；本阶段只定义端口与确定性测试替身。

- [x] **Step 1: 写入失败的成本与批次测试。**

```ts
it("calculates an inclusive-fee weighted cost across two buys", () => {
  expect(
    calculateWeightedPositionCost([
      { quantity: 100, priceFen: 1_000n, buyFeeFen: 500n },
      { quantity: 100, priceFen: 1_200n, buyFeeFen: 500n },
    ]).totalCostFen,
  ).toBe(221_000n);
});

it("allocates a sell across lots in FIFO order", () => {
  expect(
    allocateLotsFifo(
      [
        { lotId: "a", acquiredSequence: 1, remainingQuantity: 100 },
        { lotId: "b", acquiredSequence: 2, remainingQuantity: 200 },
      ],
      150,
    ).allocations,
  ).toEqual([
    { lotId: "a", quantity: 100 },
    { lotId: "b", quantity: 50 },
  ]);
});
```

- [x] **Step 2: 运行目标测试并确认失败。**

Run: `npx vitest run src/lib/paper-account/position-cost.test.ts src/lib/paper-account/lot-allocation.test.ts src/lib/paper-account/break-even-stop.test.ts src/lib/paper-account/t1-calendar.test.ts`  
Expected: FAIL，因为四个领域模块尚不存在。

- [x] **Step 3: 实现四个单一职责纯模块。**

`calculateWeightedPositionCost` 返回总数量、总成本分和每股含费成本分；`allocateLotsFifo` 按 `acquiredSequence` 升序分配并在数量超过可用量时抛出 `INSUFFICIENT_SELLABLE_LOTS`；`calculateBreakEvenStop` 通过单调递增的分价搜索调用 `calculateTradeFees({ side: "sell" })`，返回使总净回款不低于未收回成本的最小 `PriceFen`；`getNextSellableTradingDay` 调用注入日历并在空值时抛出 `NEXT_TRADING_DAY_UNAVAILABLE`。

- [x] **Step 4: 运行完整领域测试。**

修正并验证加权成本精确值 `221_000n` 分、FIFO 部分扣减、批次不足拒绝、第一目标后的含费用保本价、卖出最低佣金影响、周末/节假日替身返回的下一交易日，以及日历无结果错误。

Run: `npx vitest run src/lib/paper-account/position-cost.test.ts src/lib/paper-account/lot-allocation.test.ts src/lib/paper-account/break-even-stop.test.ts src/lib/paper-account/t1-calendar.test.ts`  
Expected: PASS，所有输入和输出均不使用浮点账本值。

- [x] **Step 5: 提交持仓领域模块。**

```bash
git add src/lib/paper-account/position-cost.ts src/lib/paper-account/lot-allocation.ts src/lib/paper-account/break-even-stop.ts src/lib/paper-account/t1-calendar.ts src/lib/paper-account/position-cost.test.ts src/lib/paper-account/lot-allocation.test.ts src/lib/paper-account/break-even-stop.test.ts src/lib/paper-account/t1-calendar.test.ts
git commit -m "feat: add paper account position calculations"
```

### Task 5: Prisma 账本模型、迁移与临时测试数据库工具

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260803_add_paper_account_ledger_foundation/migration.sql`
- Create: `scripts/run-paper-account-db-tests.mjs`
- Test: `src/server/paper-account/paper-account-schema.integration.test.ts`

**Interfaces:**

- Consumes: Task 1 的整数单位约定；现有 `PaperTrade` 模型不变。
- Produces: Prisma 模型 `PaperAccount`、`PaperAccountSettingsVersion`、`PaperPosition`、`PaperLot`、`PaperOrder`、`PaperFill`、`CashLedgerEntry`、`ExitRule`、`PaperAuditLog`、`PaperWorkerState`、`WorkerLease` 和对应枚举。
- 枚举至少包含：`PaperOrderStatus`（`proposed`、`awaiting_confirmation`、`confirmed`、`executing`、`filled`、`requires_reconfirmation`、`pending_t1`、`rejected`、`cancelled`、`failed`、`expired`）、`CashLedgerDirection`、`CashLedgerType`、`PaperOrderSide`、`PaperOrderType`、`PaperAccountStatus`、`PaperWorkerStatus`。

- [x] **Step 1: 写入失败的数据库模式集成测试。**

```ts
it("creates one account with immutable integer ledger rows and one settings version", async () => {
  const account = await prisma.paperAccount.create({
    data: {
      accountKey: "schema-test",
      initialCashFen: 10_000_000n,
      availableCashFen: 10_000_000n,
      frozenCashFen: 0n,
      realizedPnlFen: 0n,
      cumulativeFeesFen: 0n,
      accountVersion: 1,
      status: "active",
    },
  });
  await prisma.paperAccountSettingsVersion.create({
    data: {
      scopeKey: `account:${account.id}`,
      accountId: account.id,
      version: 1,
      commissionRatePpm: 250,
      minimumCommissionFen: 500n,
      stampDutySellRatePpm: 500,
      transferFeeRatePpm: 10,
      maxSingleStockBp: 3_000,
      maxTotalPositionBp: 8_000,
      maxRiskBp: 200,
      actorId: "test",
      occurredAt: new Date("2026-08-03T00:00:00.000Z"),
      idempotencyKey: "schema-test-settings-v1",
    },
  });

  // A distinct key ensures this failure is caused by [scopeKey, version].
  await expect(
    prisma.paperAccountSettingsVersion.create({
      data: {
        scopeKey: `account:${account.id}`,
        accountId: account.id,
        version: 1,
        commissionRatePpm: 250,
        minimumCommissionFen: 500n,
        stampDutySellRatePpm: 500,
        transferFeeRatePpm: 10,
        maxSingleStockBp: 3_000,
        maxTotalPositionBp: 8_000,
        maxRiskBp: 200,
        actorId: "test",
        occurredAt: new Date("2026-08-03T00:00:01.000Z"),
        idempotencyKey: "schema-test-settings-duplicate-version",
      },
    }),
  ).rejects.toThrow();
});

it("enforces global uniqueness for settings idempotency keys", async () => {
  const account = await prisma.paperAccount.create({
    data: {
      accountKey: "schema-idempotency-test",
      initialCashFen: 10_000_000n,
      availableCashFen: 10_000_000n,
      frozenCashFen: 0n,
      realizedPnlFen: 0n,
      cumulativeFeesFen: 0n,
      accountVersion: 1,
      status: "active",
    },
  });
  const settings = {
    scopeKey: `account:${account.id}`,
    accountId: account.id,
    commissionRatePpm: 250,
    minimumCommissionFen: 500n,
    stampDutySellRatePpm: 500,
    transferFeeRatePpm: 10,
    maxSingleStockBp: 3_000,
    maxTotalPositionBp: 8_000,
    maxRiskBp: 200,
    actorId: "test",
  };
  await prisma.paperAccountSettingsVersion.create({
    data: {
      ...settings,
      version: 1,
      occurredAt: new Date("2026-08-03T00:00:00.000Z"),
      idempotencyKey: "schema-test-settings-idempotency",
    },
  });
  await expect(
    prisma.paperAccountSettingsVersion.create({
      data: {
        ...settings,
        version: 2,
        occurredAt: new Date("2026-08-03T00:00:01.000Z"),
        idempotencyKey: "schema-test-settings-idempotency",
      },
    }),
  ).rejects.toThrow();
});
```

上述第一个测试只验证 `[scopeKey, version]` 唯一性：第二条记录使用不同 `idempotencyKey`，故其失败不能由幂等键约束造成。第二个测试只验证 `idempotencyKey` 全局唯一性：同一新账户的 `scopeKey` 不变、`version` 从 `1` 改为 `2`，故第二条记录的失败不能由 `[scopeKey, version]` 约束造成。

测试还必须验证：`PaperPosition` 的 `[accountId, code]` 唯一性、`PaperLot` 的 `[positionId, acquiredSequence]` 唯一性、`PaperOrder`/`CashLedgerEntry`/`PaperAuditLog` 的非空幂等键唯一性、`PaperFill` 的 `[orderId, sequence]` 唯一性、`ExitRule` 的 `[positionId, version]` 唯一性、`WorkerLease.leaseKey` 唯一性，以及删除账户被外键限制拒绝。插入一条 `CashLedgerEntry`、`PaperAuditLog` 和 `PaperFill` 后，分别调用 Prisma `update` 与 `delete`，必须因 SQLite 触发器拒绝。

- [x] **Step 2: 运行模式测试并确认失败。**

Run: `node scripts/run-paper-account-db-tests.mjs src/server/paper-account/paper-account-schema.integration.test.ts`  
Expected: FAIL，因为迁移、脚本和 Prisma 模型尚不存在。

- [x] **Step 3: 定义模型与迁移。**

所有代表现金、价格、成交额、成本、费用和盈亏的字段使用 Prisma `BigInt`；不为新模型添加 `Float` 账本字段。数量、序号、版本、ppm、bp 和状态相关字段使用 Prisma `Int` 或枚举。`PaperAccount` 存 `initialCashFen`、`availableCashFen`、`frozenCashFen`、`realizedPnlFen`、`cumulativeFeesFen`（全部为 `BigInt`）与 `accountVersion`（`Int`）。`PaperAccountSettingsVersion` 使用 `scopeKey`（`new-account-default` 或 `account:<id>`）和 `[scopeKey, version]` 唯一键，并新增唯一 `idempotencyKey`；默认范围保存 `initialCashForNewAccountsFen`（`BigInt`），账户范围保存费率与风险上限版本。`WorkerLease` 独立于 `PaperWorkerState`，因为租约的 10 秒心跳/45 秒失效生命周期与按账户和股票维护的分钟游标不同。

所有历史型关系使用 `onDelete: Restrict`；零仓位 `PaperPosition` 仍保留而不删除。迁移只创建新表、索引和外键，绝不改写 `PaperTrade`。迁移为 `CashLedgerEntry`、`PaperAuditLog` 和 `PaperFill` 创建 `BEFORE UPDATE` 与 `BEFORE DELETE` SQLite 触发器，触发时以固定错误码中止，确保账本、审计和成交在数据库层不可变。使用以下开发数据库命令生成迁移，执行前确认 `.env` 的 `DATABASE_URL` 指向预期开发库：

```bash
npx prisma migrate dev --name add_paper_account_ledger_foundation
npm run prisma:generate
```

`scripts/run-paper-account-db-tests.mjs` 必须接收一个或多个明确的测试文件路径或 glob；未传参数时立即以 `PAPER_ACCOUNT_TEST_PATTERN_REQUIRED` 失败。脚本以 `fs.mkdtemp` 在 `os.tmpdir()` 创建目录，以 `pathToFileURL` 生成临时 SQLite `DATABASE_URL`，使用 Windows 安全的 `spawn(command, args, { shell: false })` 参数数组执行 `npx prisma migrate deploy`，再以 `spawn("npx", ["vitest", "run", ...patterns], { shell: false })` 将原始 patterns 逐项传给 Vitest。无论迁移或测试成功、失败或抛错，均在 `finally` 删除临时目录；不得读取、写入、重置 `.env` 的开发数据库，也不得执行 `prisma migrate reset`。

- [x] **Step 4: 运行模式与 Prisma 生成验证。**

Run: `npm run prisma:generate`  
Expected: PASS，生成的 Prisma Client 包含新模型，旧 `PaperTrade` 仍存在。

Run: `node scripts/run-paper-account-db-tests.mjs src/server/paper-account/paper-account-schema.integration.test.ts`  
Expected: PASS，临时数据库应用迁移后所有唯一键、索引与外键断言成立。

- [x] **Step 5: 提交模式与测试隔离工具。**

```bash
git add prisma/schema.prisma prisma/migrations/20260803_add_paper_account_ledger_foundation/migration.sql scripts/run-paper-account-db-tests.mjs src/server/paper-account/paper-account-schema.integration.test.ts
git commit -m "feat: add paper account ledger schema"
```

### Task 6: Repository 接口与共享 Prisma 事务上下文

**Files:**

- Create: `src/server/paper-account/paper-account-repositories.ts`
- Create: `src/server/paper-account/prisma-paper-account-repositories.ts`
- Create: `src/server/paper-account/paper-account-unit-of-work.ts`
- Create: `src/server/paper-account/prisma-paper-account-unit-of-work.ts`
- Create: `src/server/paper-account/paper-account-prisma-client.ts`
- Test: `src/server/paper-account/paper-account-unit-of-work.test.ts`

**Interfaces:**

- Consumes: Task 5 生成的 Prisma 模型和枚举；Task 1 的 `MoneyFen`、`RatePpm`、`BasisPoints`。
- Produces: `PaperAccountRecord`、`PaperAccountSettingsVersionRecord`、`PaperPositionRecord`、`PaperLotRecord`、`PaperOrderRecord`、`PaperFillRecord`、`CashLedgerEntryRecord`、`ExitRuleRecord`、`PaperAuditLogRecord`、`PaperWorkerStateRecord`、`WorkerLeaseRecord`、全部 Create/Update 输入类型、11 个独立 Repository、`PaperAccountTransactionContext`、`PaperAccountUnitOfWork`、`createPrismaPaperAccountUnitOfWork(prismaClient)`。
- `PaperAccountUnitOfWork.run<T>(work: (context: PaperAccountTransactionContext) => Promise<T>): Promise<T>`。
- `PaperAccountTransactionContext` 必须精确为：

```ts
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
```

- 所有 11 个 Repository 由同一个 transaction client 绑定。读取方法可在该 context 中调用；写入方法只能由 `PaperAccountUnitOfWork.run()` 创建的 context 调用。领域服务不接收未绑定 transaction client 的写入 Repository；Task 9 的读取只能使用这些接口，不能直接查询 Prisma。
- `PaperAccountRepository`：`findById(accountId: string): Promise<PaperAccountRecord | null>`、`findByKey(accountKey: string): Promise<PaperAccountRecord | null>`、`create(input: CreatePaperAccountInput): Promise<PaperAccountRecord>`、`updateCash(input: { accountId: string; availableCashFen: MoneyFen; frozenCashFen: MoneyFen; realizedPnlFen?: MoneyFen; cumulativeFeesFen?: MoneyFen; expectedAccountVersion: number }): Promise<PaperAccountRecord>`。
- `PaperAccountSettingsRepository`：`findLatestByScope(scopeKey: string): Promise<PaperAccountSettingsVersionRecord | null>`、`listByScope(scopeKey: string): Promise<PaperAccountSettingsVersionRecord[]>`、`findByIdempotencyKey(idempotencyKey: string): Promise<PaperAccountSettingsVersionRecord | null>`、`append(input: PaperAccountSettingsVersionInput): Promise<PaperAccountSettingsVersionRecord>`。`PaperAccountSettingsVersionInput` 包含 `scopeKey`、`accountId?`、`version`、`initialCashForNewAccountsFen?`、四项费用字段、三项 bp 上限、`actorId`、`occurredAt: string` 与唯一 `idempotencyKey: string`；该输入层不得接受 `Date`，Prisma 映射层统一转换为 `Date` 后写入。
- `PaperPositionRepository`：`findByAccountAndCode(accountId: string, code: string): Promise<PaperPositionRecord | null>`、`listByAccount(accountId: string): Promise<PaperPositionRecord[]>`、`create(input: CreatePaperPositionInput): Promise<PaperPositionRecord>`、`updateWithVersion(input: UpdatePaperPositionInput & { expectedVersion: number }): Promise<PaperPositionRecord>`。
- `PaperLotRepository`：`listByPosition(positionId: string): Promise<PaperLotRecord[]>`、`listSellableByPosition(positionId: string, tradingDate: string): Promise<PaperLotRecord[]>`、`append(input: CreatePaperLotInput): Promise<PaperLotRecord>`、`updateRemainingQuantity(input: { lotId: string; remainingQuantity: number; expectedRemainingQuantity: number }): Promise<PaperLotRecord>`。
- `PaperOrderRepository`：`findById(orderId: string): Promise<PaperOrderRecord | null>`、`findByIdempotencyKey(idempotencyKey: string): Promise<PaperOrderRecord | null>`、`listByAccount(accountId: string): Promise<PaperOrderRecord[]>`、`append(input: CreatePaperOrderInput): Promise<PaperOrderRecord>`、`updateStatusWithVersion(input: { orderId: string; fromStatus: PaperOrderStatus; toStatus: PaperOrderStatus; expectedVersion: number }): Promise<PaperOrderRecord>`。
- `PaperFillRepository`：`findByOrderAndSequence(orderId: string, sequence: number): Promise<PaperFillRecord | null>`、`listByOrder(orderId: string): Promise<PaperFillRecord[]>`、`listByAccount(accountId: string): Promise<PaperFillRecord[]>`、`append(input: CreatePaperFillInput): Promise<PaperFillRecord>`；不得提供 `update` 或 `delete`。
- `CashLedgerRepository`：`findByIdempotencyKey(idempotencyKey: string): Promise<CashLedgerEntryRecord | null>`、`listByAccount(accountId: string): Promise<CashLedgerEntryRecord[]>`、`sumByAccount(accountId: string): Promise<{ creditsFen: MoneyFen; debitsFen: MoneyFen; netFen: MoneyFen }>`、`append(input: CashLedgerEntryInput): Promise<CashLedgerEntryRecord>`；不得提供 `update` 或 `delete`。
- `ExitRuleRepository`：`findActiveByPosition(positionId: string): Promise<ExitRuleRecord | null>`、`listByPosition(positionId: string): Promise<ExitRuleRecord[]>`、`append(input: CreateExitRuleInput): Promise<ExitRuleRecord>`、`supersede(input: { ruleId: string; expectedVersion: number }): Promise<ExitRuleRecord>`。
- `PaperAuditRepository`：`findByIdempotencyKey(idempotencyKey: string): Promise<PaperAuditLogRecord | null>`、`listByAccount(accountId: string): Promise<PaperAuditLogRecord[]>`、`append(input: PaperAuditLogInput): Promise<PaperAuditLogRecord>`；不得提供 `update` 或 `delete`。
- `PaperWorkerStateRepository`：`findByAccountAndCode(accountId: string, code: string): Promise<PaperWorkerStateRecord | null>`、`listByAccount(accountId: string): Promise<PaperWorkerStateRecord[]>`、`upsertWithVersion(input: UpsertPaperWorkerStateInput): Promise<PaperWorkerStateRecord>`；本阶段只定义持久化接口，不实现 30 秒循环或自动退出。
- `WorkerLeaseRepository`：`findByKey(leaseKey: string): Promise<WorkerLeaseRecord | null>`、`acquire(input: AcquireWorkerLeaseInput): Promise<WorkerLeaseRecord>`、`heartbeat(input: { leaseKey: string; workerId: string; expectedVersion: number; heartbeatAt: string; expiresAt: string }): Promise<WorkerLeaseRecord>`、`release(input: { leaseKey: string; workerId: string; expectedVersion: number }): Promise<WorkerLeaseRecord>`；本阶段只建立数据库与 Repository 边界，不实现 Worker。

- [x] **Step 1: 写入失败的共享事务测试。**

```ts
it("binds account, ledger, settings, and audit repositories to one transaction context", async () => {
  const unitOfWork = createPrismaPaperAccountUnitOfWork(testPrisma);
  await unitOfWork
    .run(async ({ accounts, ledger, settings, audit }) => {
      const account = await accounts.create({
        accountKey: "transaction-test",
        initialCashFen: 10_000_000n,
        status: "active",
      });
      await settings.append({
        scopeKey: `account:${account.id}`,
        version: 1,
        commissionRatePpm: 250,
        minimumCommissionFen: 500n,
        stampDutySellRatePpm: 500,
        transferFeeRatePpm: 10,
        maxSingleStockBp: 3_000,
        maxTotalPositionBp: 8_000,
        maxRiskBp: 200,
        actorId: "test",
        occurredAt: "2026-08-03T00:00:00.000Z",
        idempotencyKey: "transaction-test-settings-v1",
      });
      await ledger.append({
        accountId: account.id,
        sequence: 1,
        type: "initial_funding",
        direction: "credit",
        amountFen: 10_000_000n,
        reason: "test opening",
        actorId: "test",
      });
      await audit.append({
        accountId: account.id,
        sequence: 1,
        eventType: "account_initialized",
        actorId: "test",
        payloadJson: "{}",
      });
      throw new Error("ROLLBACK_FOR_TEST");
    })
    .catch(() => undefined);
  expect(await testPrisma.paperAccount.count()).toBe(0);
});
```

- [x] **Step 2: 运行目标测试并确认失败。**

Run: `node scripts/run-paper-account-db-tests.mjs src/server/paper-account/paper-account-unit-of-work.test.ts`  
Expected: FAIL，因为 Unit of Work 与 Repository 接口尚不存在。

- [x] **Step 3: 实现 Repository 边界。**

`PaperAccountRepository` 只处理账户状态与乐观版本；`PaperAccountSettingsRepository` 只处理不可覆盖的设置版本；`PaperPositionRepository` 只处理汇总持仓；`PaperLotRepository` 只处理买入批次；`PaperOrderRepository` 只处理可变订单状态；`PaperFillRepository` 只处理不可变成交；`CashLedgerRepository` 只处理不可变资金流水；`ExitRuleRepository` 只处理退出规则版本；`PaperAuditRepository` 只处理不可变审计日志；`PaperWorkerStateRepository` 只处理账户/股票游标与监控状态；`WorkerLeaseRepository` 只处理租约与心跳。不可变表的 Repository 不提供 `update` 或 `delete`，Task 5 的 SQLite 触发器继续提供第二层保护。

领域服务只依赖 `PaperAccountUnitOfWork` 和 Repository 接口，不导入全局 Prisma Client。`paper-account-prisma-client.ts` 是基础设施组合根，使用与现有 `src/server/trading-memory/prisma-client.ts` 相同的全局单例模式；`prisma-paper-account-unit-of-work.ts` 在一次 `prisma.$transaction` 内创建全部 Repository，禁止 Repository 自行开启或提交事务。

- [x] **Step 4: 运行事务与接口测试。**

补充测试：乐观更新的 `expectedAccountVersion` 不匹配时返回 `ACCOUNT_VERSION_CONFLICT`；重复幂等键返回既有实体或固定冲突错误；Repository 无法脱离事务上下文执行写入。

Run: `node scripts/run-paper-account-db-tests.mjs src/server/paper-account/paper-account-unit-of-work.test.ts`  
Expected: PASS，事务抛错后数据库零写入，成功事务所有写入一起可见。

- [x] **Step 5: 提交事务基础设施。**

```bash
git add src/server/paper-account/paper-account-repositories.ts src/server/paper-account/prisma-paper-account-repositories.ts src/server/paper-account/paper-account-unit-of-work.ts src/server/paper-account/prisma-paper-account-unit-of-work.ts src/server/paper-account/paper-account-prisma-client.ts src/server/paper-account/paper-account-unit-of-work.test.ts
git commit -m "feat: add paper account transaction repositories"
```

### Task 7: 幂等默认账户初始化

**Files:**

- Create: `src/server/paper-account/paper-account-initializer.ts`
- Test: `src/server/paper-account/paper-account-initializer.test.ts`
- Test: `src/server/paper-account/paper-account-initializer.integration.test.ts`

**Interfaces:**

- Consumes: Task 5 模型、Task 6 的 `PaperAccountUnitOfWork`、Repository 接口和事务上下文。
- Produces: `InitializeDefaultPaperAccountInput`、`InitializeDefaultPaperAccountResult`、`createPaperAccountInitializer(unitOfWork)`。
- `initializeDefaultPaperAccount(input: InitializeDefaultPaperAccountInput): Promise<InitializeDefaultPaperAccountResult>`；Prisma BigInt 金额从读取、计算到返回均保持 `bigint`，只有未来 API/MCP 展示适配器才转换为十进制字符串。
- 输入类型：`{ accountKey: string; actorId: string; occurredAt: string; idempotencyKey: string }`。
- 返回类型：`{ accountId: string; created: boolean; initialCashFen: MoneyFen; settingsVersion: number }`。

- [x] **Step 1: 写入失败的初始化测试。**

```ts
it("creates account, opening ledger, settings version, and audit record atomically", async () => {
  const result = await initializer.initializeDefaultPaperAccount({
    accountKey: "default",
    actorId: "system",
    occurredAt: "2026-08-03T00:00:00.000Z",
    idempotencyKey: "default-account-v1",
  });
  expect(result).toMatchObject({ created: true, initialCashFen: 10_000_000n, settingsVersion: 1 });
});
```

- [x] **Step 2: 运行目标测试并确认失败。**

Run: `npx vitest run src/server/paper-account/paper-account-initializer.test.ts`  
Expected: FAIL，因为初始化服务尚不存在。

- [x] **Step 3: 实现初始化服务。**

服务在一个 Unit of Work 中先按 `accountKey` 查找；存在时返回既有账户并返回 `created: false`。不存在时读取 `new-account-default` 的最新设置版本；若默认模板不存在，创建版本 1，精确写入 10,000,000 分、250 ppm、500 分最低佣金、500 ppm 印花税、10 ppm 过户费、3,000/8,000/200 bp 风控设置。随后创建账户、账户范围设置版本 1、贷方 `initial_funding` 流水和 `account_initialized` 审计日志。任何一步异常都让 Unit of Work 回滚。

- [x] **Step 4: 运行单元与临时数据库集成测试。**

集成测试必须断言重复调用只得到一个账户、一条初始流水和一条初始化审计日志；注入抛错的审计 Repository 后，账户、设置和流水全部不存在；初始现金只来自新账户默认设置而非硬编码覆盖已有账户。

Run: `npx vitest run src/server/paper-account/paper-account-initializer.test.ts`  
Expected: PASS。

Run: `node scripts/run-paper-account-db-tests.mjs src/server/paper-account/paper-account-initializer.integration.test.ts`  
Expected: PASS，重复初始化保持幂等，失败初始化完全回滚。

- [x] **Step 5: 提交初始化服务。**

```bash
git add src/server/paper-account/paper-account-initializer.ts src/server/paper-account/paper-account-initializer.test.ts src/server/paper-account/paper-account-initializer.integration.test.ts
git commit -m "feat: initialize default paper account ledger"
```

### Task 8: 设置版本与不可变资金调整边界

**Files:**

- Create: `src/server/paper-account/paper-account-settings-service.ts`
- Create: `src/server/paper-account/paper-account-cash-adjustment-service.ts`
- Test: `src/server/paper-account/paper-account-settings-service.test.ts`
- Test: `src/server/paper-account/paper-account-cash-adjustment-service.test.ts`
- Test: `src/server/paper-account/paper-account-settings.integration.test.ts`

**Interfaces:**

- Consumes: Task 1 标量、Task 5 模型、Task 6 Unit of Work、Task 7 初始化结果。
- Produces: `updateNewAccountDefaults(input: UpdateNewAccountDefaultsInput): Promise<PaperAccountSettingsVersionRecord>`、`createAccountSettingsVersion(input: CreateAccountSettingsVersionInput): Promise<PaperAccountSettingsVersionRecord>`、`adjustPaperAccountCash(input: AdjustPaperAccountCashInput): Promise<CashAdjustmentResult>`。
- `AdjustPaperAccountCashInput`: `{ accountId: string; direction: "credit" | "debit"; amountFen: MoneyFen; reason: string; actorId: string; occurredAt: string; idempotencyKey: string; expectedAccountVersion: number }`。
- `CashAdjustmentResult`: `{ ledgerEntryId: string; availableCashFen: MoneyFen; accountVersion: number; created: boolean }`。

- [x] **Step 1: 写入失败的设置与资金调整测试。**

```ts
it("changes the default initial cash only for accounts created afterwards", async () => {
  await settings.updateNewAccountDefaults({
    initialCashForNewAccountsFen: 20_000_000n,
    actorId: "admin",
    occurredAt: "2026-08-03T00:00:00.000Z",
    idempotencyKey: "defaults-v2",
  });
  expect(
    (
      await initializer.initializeDefaultPaperAccount({
        accountKey: "future",
        actorId: "system",
        occurredAt,
        idempotencyKey: "future-v1",
      })
    ).initialCashFen,
  ).toBe(20_000_000n);
  expect((await accounts.findByKey("default"))?.initialCashFen).toBe(10_000_000n);
});

it("adjusts an existing account only by an immutable ledger entry", async () => {
  await expect(
    settings.createAccountSettingsVersion({
      accountId,
      commissionRatePpm: 250,
      minimumCommissionFen: 500n,
      stampDutySellRatePpm: 500,
      transferFeeRatePpm: 10,
      maxSingleStockBp: 3_000,
      maxTotalPositionBp: 8_000,
      maxRiskBp: 200,
      initialCashForNewAccountsFen: 1n,
      actorId: "admin",
      occurredAt: "2026-08-03T00:00:01.000Z",
      idempotencyKey: "illegal-existing-initial-cash",
    }),
  ).rejects.toThrow("INITIAL_CASH_IMMUTABLE");
});
```

- [x] **Step 2: 运行目标测试并确认失败。**

Run: `npx vitest run src/server/paper-account/paper-account-settings-service.test.ts src/server/paper-account/paper-account-cash-adjustment-service.test.ts`  
Expected: FAIL，因为设置和资金调整服务尚不存在。

- [x] **Step 3: 实现版本化设置和资金调整服务。**

`updateNewAccountDefaults` 创建 `new-account-default` 的下一个版本而不更新旧行。`createAccountSettingsVersion` 只接受费率与风险上限，拒绝任何既有账户初始资金字段。`adjustPaperAccountCash` 在一个 Unit of Work 中校验 `expectedAccountVersion`、借方余额、幂等键和非空原因；追加不可变流水、更新账户可用现金缓存与版本、追加审计日志。重复 `idempotencyKey` 返回第一次结果，不能重复增加余额。

- [x] **Step 4: 运行完整设置与资金调整测试。**

覆盖默认佣金/税费/仓位参数、历史设置版本不可覆盖、已有账户初始资金不可改、贷方与借方流水、借方余额不足拒绝、审计字段齐全、重复幂等键、账户版本冲突和账本余额与缓存一致。

Run: `node scripts/run-paper-account-db-tests.mjs src/server/paper-account/paper-account-settings.integration.test.ts`  
Expected: PASS，临时数据库中设置版本追加而非覆盖，资金调整只产生追加流水。

- [x] **Step 5: 提交设置与资金调整服务。**

```bash
git add src/server/paper-account/paper-account-settings-service.ts src/server/paper-account/paper-account-cash-adjustment-service.ts src/server/paper-account/paper-account-settings-service.test.ts src/server/paper-account/paper-account-cash-adjustment-service.test.ts src/server/paper-account/paper-account-settings.integration.test.ts
git commit -m "feat: add paper account settings and cash ledger"
```

### Task 9: 账户快照与账本一致性检查

**Files:**

- Create: `src/server/paper-account/paper-account-quote-port.ts`
- Create: `src/server/paper-account/paper-account-snapshot-service.ts`
- Create: `src/server/paper-account/paper-account-integrity-service.ts`
- Test: `src/server/paper-account/paper-account-snapshot-service.test.ts`
- Test: `src/server/paper-account/paper-account-integrity-service.test.ts`
- Test: `src/server/paper-account/paper-account-integrity.integration.test.ts`

**Interfaces:**

- Consumes: Task 1 的金额类型、Task 5 模型、Task 6 的只读 Repository、Task 8 的账户余额与设置版本。
- Produces: `PaperAccountQuoteReader`、`PaperAccountSnapshot`、`getPaperAccountSnapshot(input)`、`checkPaperAccountIntegrity(accountId)`。
- `PaperAccountQuoteReader.getLatestQuotes(codes: string[]): Promise<ReadonlyMap<string, { priceFen: PriceFen; status: "fresh" | "delayed" | "stale" | "unavailable"; observedAt: string }>>`。
- `PaperAccountSnapshot`: `{ accountId: string; availableCashFen: MoneyFen; frozenCashFen: MoneyFen; positionMarketValueFen: MoneyFen | null; totalAssetsFen: MoneyFen | null; realizedPnlFen: MoneyFen; cumulativeFeesFen: MoneyFen; settingsVersion: number; quoteStatus: "fresh" | "unavailable" }`。
- `getPaperAccountSnapshot(input: { accountId: string; quoteReader: PaperAccountQuoteReader }): Promise<PaperAccountSnapshot>`；`serializePaperAccountSnapshot(snapshot: PaperAccountSnapshot): PaperAccountSnapshotDto` 将每个 `bigint` 字段转换为十进制字符串，DTO 返回 `{ availableCashFen: string; frozenCashFen: string; positionMarketValueFen: string | null; totalAssetsFen: string | null; realizedPnlFen: string; cumulativeFeesFen: string; availableCash: string; frozenCash: string; positionMarketValue: string | null; totalAssets: string | null }`。JSON 示例只包含字符串金额，绝不直接包含 `bigint`。
- `checkPaperAccountIntegrity(accountId): Promise<{ valid: boolean; issues: string[]; ledgerCashFen: MoneyFen; cachedCashFen: MoneyFen }>`。

- [x] **Step 1: 写入失败的快照和一致性测试。**

```ts
it("separates ledger-derived cash from quote-derived market value", async () => {
  const snapshot = await snapshotService.getPaperAccountSnapshot({
    accountId,
    quoteReader: fixedQuotes({ "002472": 1_250n }),
  });
  expect(snapshot.availableCashFen).toBe(9_000_000n);
  expect(snapshot.positionMarketValueFen).toBe(125_000n);
});

it("reports a cache mismatch without changing the ledger", async () => {
  const result = await integrityService.checkPaperAccountIntegrity(accountId);
  expect(result.valid).toBe(false);
  expect(result.issues).toContain("CASH_CACHE_MISMATCH");
});

it("serializes bigint monetary fields as decimal strings before JSON", () => {
  const dto = serializePaperAccountSnapshot(snapshotWithMoney(10_000_000n));
  expect(JSON.stringify(dto)).toContain('"availableCashFen":"10000000"');
});
```

- [x] **Step 2: 运行目标测试并确认失败。**

Run: `npx vitest run src/server/paper-account/paper-account-snapshot-service.test.ts src/server/paper-account/paper-account-integrity-service.test.ts`  
Expected: FAIL，因为快照、报价端口和一致性服务尚不存在。

- [x] **Step 3: 实现只读快照和一致性服务。**

快照服务从账本/账户读取可用现金、冻结现金、已实现盈亏、累计费用和设置版本；所有金额保持 `bigint`。只从注入的 `PaperAccountQuoteReader` 计算持仓市值与总资产。报价缺失、延迟或不可用时返回 `positionMarketValueFen: null`、`totalAssetsFen: null`、`quoteStatus: "unavailable"`，不调用真实行情，也不使用旧价代替。`serializePaperAccountSnapshot` 在 JSON 边界将每个 `bigint` 转为十进制字符串。完整性服务重新汇总所有借贷流水，比较账户缓存余额、冻结现金、累计费用、持仓数量与批次剩余数量，并只报告问题，绝不自动修复数据。

- [x] **Step 4: 运行完整快照与一致性测试。**

覆盖无行情、fresh 行情、延迟行情、冻结现金、持仓市值、总资产、已实现盈亏、累计费用、设置版本、流水/缓存一致、资金不一致、批次/持仓数量不一致和审计日志保持不变。

Run: `node scripts/run-paper-account-db-tests.mjs src/server/paper-account/paper-account-integrity.integration.test.ts`  
Expected: PASS，所有检查在临时数据库上执行，开发数据库无写入。

- [x] **Step 5: 提交快照与一致性服务。**

```bash
git add src/server/paper-account/paper-account-quote-port.ts src/server/paper-account/paper-account-snapshot-service.ts src/server/paper-account/paper-account-integrity-service.ts src/server/paper-account/paper-account-snapshot-service.test.ts src/server/paper-account/paper-account-integrity-service.test.ts src/server/paper-account/paper-account-integrity.integration.test.ts
git commit -m "feat: add paper account snapshots and integrity checks"
```

### Task 10: 完整回归、构建和计划核对

**Files:**

- Modify: `docs/superpowers/plans/2026-08-03-paper-account-ledger-foundation.md`（仅将已完成的复选框标为完成，并补充实际命令结果）
- Test: `docs/superpowers/plans/2026-08-03-paper-account-ledger-foundation.md`（执行前安全检查与命令结果记录）

**Interfaces:**

- Consumes: Tasks 1 至 9 创建的纯函数、Prisma 模型、临时数据库脚本、Repository、初始化、设置、快照和一致性检查服务。
- Produces: 已核对的计划记录和可提交的稳定基线；不产生页面、MCP、Worker、订单确认或券商执行接口。

- [x] **Step 1: 先运行专属测试并记录失败原因。**

Run: `node scripts/run-paper-account-db-tests.mjs "src/server/paper-account/**/*.integration.test.ts"`
Expected before Tasks 1 至 9 全部完成: FAIL，输出缺失模块、缺失迁移或未实现接口的具体路径；完成前序任务后该命令必须 PASS。

- [ ] **Step 2: 运行全量质量命令。**

```bash
npm run prisma:generate
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Expected: 所有命令 PASS；`npm test` 包含旧 PaperTrade 测试、行情、策略、分钟线和回测回归测试；`npm run build` 不修改运行时数据。

- [x] **Step 3: 核对迁移和测试数据库隔离。**

运行 `node scripts/run-paper-account-db-tests.mjs "src/server/paper-account/**/*.integration.test.ts"`，确认日志中的数据库路径位于系统临时目录，脚本结束后该目录被删除；确认 `.env` 中的 `DATABASE_URL` 文件时间戳和内容未改变；确认未运行 `prisma migrate reset`。

- [x] **Step 4: 核对范围与计划完成状态。**

检查 `prisma/schema.prisma` 中旧 `PaperTrade` 模型未变更，检查新增代码不包含页面路由、API 路由、MCP 服务器、Worker 定时器、券商 Provider 或真实行情调用。将本计划所有已通过步骤的复选框标为 `- [x]`，并在本任务末尾写入实际测试命令和通过日期。

- [x] **Step 5: 提交最终验证记录。**

```bash
git add docs/superpowers/plans/2026-08-03-paper-account-ledger-foundation.md
git commit -m "docs: record paper account ledger verification"
```
#### 实际验证结果（2026-08-05）

**最终状态：** `DONE_WITH_CONCERNS`

**提交前基线：**

- 分支：`codex/paper-trading-closed-loop`
- 验证基线HEAD：`b75721a20cc7733a39515e04c2f2ce147f914bbb`
- 工作区仅保留三个既有未跟踪脚本，零已跟踪代码修改。

**专属集成验证：**

- 正序运行4个Paper Account集成测试文件：`38/38`通过。
- 反序运行同一组文件：`38/38`通过。
- 测试SQLite文件位于系统临时目录，结束后临时目录已删除。
- 测试进程使用独立`DATABASE_URL`，结束后环境变量已恢复。
- `.env`的内容哈希和修改时间均未改变。
- 未执行`prisma migrate reset`或`prisma migrate dev`。

**全量质量命令：**

- `npm run prisma:generate`：退出码`0`，Prisma `6.19.3`。
- `npx tsc --noEmit`：退出码`0`，`0 errors`。
- `npm run lint`：退出码`1`，`1 error / 22 warnings`。
- `npm test`：退出码`1`，`105 files / 961 tests / 958 passed / 3 failed`。
- `npm run build`：退出码`0`，编译、路由分析和静态页面生成成功。

**已知范围外基线问题：**

- Lint：`src/components/layout/sidebar.tsx:26:21` 的`react-hooks/set-state-in-effect`错误；其余22项warning均为既有问题。
- 测试：`src/app/stocks/[code]/error.test.tsx` 因App Router未挂载失败。
- 测试：`.worktrees/tencent-minute-kline-task1/src/server/market-data/capability-matrix.test.ts` 因既有数据源期望不一致失败。
- 测试：`.worktrees/tencent-minute-kline-task1/src/server/watchlist-storage/dynamic-watchlist-repository.test.ts` 因既有Prisma测试初始化问题失败。
- Task 1至Task 9新增文件为`0 lint errors / 0 lint warnings`，其新增测试全部通过。

**兼容与范围：**

- 旧`PaperTrade`模型与Task 1父提交中的模型块逐字符一致。
- 新迁移未对旧`PaperTrade`执行删除、更新或结构修改。
- 新生产代码不写入旧`PaperTrade`。
- 本阶段未增加页面、API路由、MCP、Worker、券商Provider或真实行情调用。
- 构建前后`.env`与`prisma`目录中的数据库文件均未改变。
- 构建未产生任何已跟踪文件修改。

**复选框说明：**

- Task 1至Task 9共45个Step均已完成。
- Task 10的Step 1、Step 3、Step 4和Step 5已完成。
- Task 10 Step 2保持未勾选，因为全量Lint和全量测试仍存在上述已知范围外基线失败。
- 总计：`49/50`个Step完成。

## 计划自检映射

| 设计要求                                                                | 覆盖任务                       |
| ----------------------------------------------------------------------- | ------------------------------ |
| 账户、设置、持仓、批次、订单、成交、流水、退出、审计、Worker 状态与租约 | Task 5、Task 6                 |
| 金额精度、费率、舍入与默认参数                                          | Task 1、Task 2、Task 5、Task 8 |
| 2%、30%、80%、整手与风险例外计算                                        | Task 3                         |
| 加权成本、FIFO、保本价和 T+1 接口                                       | Task 4                         |
| 默认账户幂等初始化和完全回滚                                            | Task 7                         |
| 版本化设置、历史费率快照、不可变资金调整                                | Task 5、Task 8                 |
| 查询快照、报价注入边界和账本一致性                                      | Task 9                         |
| 单元、事务、并发、迁移、隔离和全量回归                                  | Task 1 至 Task 10              |
| 不实现订单确认、Worker、页面、MCP、券商和实时行情                       | Global Constraints、Task 10    |

## 执行前安全检查

- 仅对开发数据库执行 `npx prisma migrate dev --name add_paper_account_ledger_foundation`，执行前人工确认 `.env` 的 `DATABASE_URL`。
- 仅临时测试数据库执行 `npx prisma migrate deploy`；不执行任何重置开发数据库的命令。
- 每个任务使用列出的精确 `git add` 路径；不得使用 `git add .`、`git add -A` 或 `git add --all`。
- 每个任务完成后先运行其目标测试，再运行关联测试集并提交；出现失败时先修复该任务范围内的失败，再进入下一任务。
