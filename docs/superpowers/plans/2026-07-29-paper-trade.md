# 模拟买入与回测 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在详情页创建、持久化、自动结算并展示只用于研究的模拟交易。

**Architecture:** 新增独立 `PaperTrade` Prisma 模型及 repository/service，服务端从策略输入和真实报价构造交易，读取时执行确定性的止盈、止损和第 5 个交易日收盘价结算。客户端只调用同源 API 并渲染结果。

**Tech Stack:** Next.js App Router、TypeScript、Prisma、SQLite、Vitest、现有腾讯报价和日线快照。

## Global Constraints

- 所有 PaperTrade 永远标记 `isDemo=true`，不连接券商或下单。
- 到期使用第 5 个交易日收盘价，不使用未来或 Mock 价格。
- 不修改分钟 K 线接口、周期切换和自动刷新。
- 不执行 `prisma migrate reset`，现有 SQLite 数据和种子数据必须保留。

---

### Task 1: 持久化模型与迁移

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_paper_trade/migration.sql`
- Test: `src/server/paper-trading/paper-trade-repository.test.ts`

**Interfaces:**
- Produces `PaperTrade`, `PaperTradeStatus`, `PaperTradeExitReason` Prisma 类型。
- Produces `PaperTradeRepository` 的 `createOpen`, `findOpenByCode`, `listByCode`, `settle` 方法。

- [ ] **Step 1: 写失败的 repository 测试**

```ts
it("stores one open paper trade and returns it after a new repository instance", async () => {
  const created = await repository.createOpen(input);
  await expect(newRepository.findOpenByCode("002472")).resolves.toMatchObject({ id: created.id, status: "open" });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/server/paper-trading/paper-trade-repository.test.ts`

- [ ] **Step 3: 新增 schema、迁移、repository 类型和 Prisma 实现**

```ts
type PaperTradeStatus = "open" | "take_profit" | "stop_loss" | "expired";
async function settle(id: string, outcome: Exclude<PaperTradeStatus, "open">, exitPrice: number, exitTime: string): Promise<PaperTradeRecord>;
```

- [ ] **Step 4: 安全应用迁移并确认测试通过**

Run: `npx prisma generate`, `npx prisma migrate deploy`, `npx vitest run src/server/paper-trading/paper-trade-repository.test.ts`

### Task 2: 纯结算规则与服务

**Files:**
- Create: `src/server/paper-trading/paper-trade-settlement.ts`
- Create: `src/server/paper-trading/paper-trade-service.ts`
- Test: `src/server/paper-trading/paper-trade-settlement.test.ts`

**Interfaces:**
- Consumes `entryPrice`, `takeProfitPrice`, `stopLossPrice`, 最新报价和第 5 个交易日收盘价。
- Produces `settlePaperTrade(input): SettlementDecision | null`。

- [ ] **Step 1: 写失败的纯函数测试**

```ts
expect(settlePaperTrade({ trade, quotePrice: 12, expiryClose: null })).toMatchObject({ status: "take_profit", exitPrice: 12 });
expect(settlePaperTrade({ trade, quotePrice: 8, expiryClose: null })).toMatchObject({ status: "stop_loss", exitPrice: 9 });
expect(settlePaperTrade({ trade: expiredTrade, quotePrice: 10, expiryClose: 10.5 })).toMatchObject({ status: "expired", exitPrice: 10.5 });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/server/paper-trading/paper-trade-settlement.test.ts`

- [ ] **Step 3: 实现结算函数和 service**

```ts
function calculateReturnPercent(entryPrice: number, exitPrice: number): number {
  return Number((((exitPrice - entryPrice) / entryPrice) * 100).toFixed(2));
}
```

服务必须使用 `buildStrategyInputForCode`、`MarketDataService.getQuote` 与 SQLite 日线快照；报价或到期收盘价缺失时保持 `open`。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/server/paper-trading/paper-trade-settlement.test.ts src/server/paper-trading/paper-trade-repository.test.ts`

### Task 3: API 与重复点击保护

**Files:**
- Create: `src/app/api/paper-trades/route.ts`
- Create: `src/server/paper-trading/paper-trade-api.test.ts`

**Interfaces:**
- `POST { code: string }` 返回 `{ success: true, data: PaperTradeRecord }`。
- `GET ?code=002472` 返回该股票的已结算和未结算模拟交易。

- [ ] **Step 1: 写失败的 API/service 测试**

```ts
it("returns the existing open trade for a repeated buy request", async () => {
  const first = await service.createFromCurrentMarket("002472");
  await expect(service.createFromCurrentMarket("002472")).resolves.toMatchObject({ id: first.id, status: "open" });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/server/paper-trading/paper-trade-api.test.ts`

- [ ] **Step 3: 实现 route 和输入校验**

服务端只接受六位代码；买入价、止盈和止损均从服务端行情与策略计划获取，拒绝客户端传入价格。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/server/paper-trading/paper-trade-api.test.ts`

### Task 4: 个股详情页交互与结果展示

**Files:**
- Create: `src/components/stocks/detail/paper-trade-panel.tsx`
- Modify: `src/components/stocks/stock-detail-view.tsx`
- Test: `src/components/stocks/detail/paper-trade-panel.test.tsx`

**Interfaces:**
- Consumes `code`、股票名称和当前策略计划。
- Calls `POST /api/paper-trades` and `GET /api/paper-trades?code=<code>`.

- [ ] **Step 1: 写失败的组件测试**

```tsx
render(<PaperTradePanel code="002472" name="双环传动" />);
expect(screen.getByRole("button", { name: "模拟买入" })).toBeEnabled();
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/components/stocks/detail/paper-trade-panel.test.tsx`

- [ ] **Step 3: 实现面板**

显示“模拟交易”标识、买入价、当前/卖出价、收益率、创建/结算时间和状态。重复提交期间禁用按钮；成功后刷新该股票的记录。不得修改分钟图表组件。

- [ ] **Step 4: 运行组件测试确认通过**

Run: `npx vitest run src/components/stocks/detail/paper-trade-panel.test.tsx`

### Task 5: 全量验收

**Files:**
- Modify: `README.md`（补充模拟交易边界与运行说明）

- [ ] **Step 1: 运行数据库与全量检查**

Run: `npx prisma generate`, `npx prisma migrate deploy`, `npx tsc --noEmit`, `npm run lint`, `npm run test -- --exclude ".worktrees/**"`, `npm run build -- --webpack`

- [ ] **Step 2: 手动验证**

访问 `http://localhost:3000/stocks/002472`，点击一次“模拟买入”，刷新页面后确认记录存在；再次点击确认没有第二笔 `open` 记录；确认 1m/5m/15m/30m/60m 按钮和自动刷新仍可用。
