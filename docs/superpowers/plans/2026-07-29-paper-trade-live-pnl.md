# Paper Trade Live P&L Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在模拟交易列表中展示进行中记录的服务端实时报价和浮动盈亏，并支持局部更新的手动平仓。

**Architecture:** 市场服务在既有批量列表结算过程内收集每笔进行中记录的可用报价，并将其作为附加响应数据返回。列表客户端在可见页面每 30 秒请求现有列表接口；平仓响应携带更新记录与统计，客户端替换本地状态而非刷新页面。

**Tech Stack:** Next.js App Router、React、TypeScript、Vitest、Prisma。

## Global Constraints

- 只影响 `/paper-trades` 的刷新逻辑；不修改详情页、分钟 K 线或其自动刷新。
- 页面可见时每 30 秒刷新；页面隐藏时暂停。
- 只使用 `POST /api/paper-trades/[id]/close`；客户端不得提交成交价。
- 真实报价不可用时不阻塞列表，显示 `--`，不伪造数据。
- 已结算记录不显示实时价、浮盈或平仓按钮。

---

### Task 1: 列表服务返回进行中交易的实时报价

**Files:**
- Modify: `src/server/paper-trading/paper-trade-market-service.ts`
- Test: `src/server/paper-trading/paper-trade-market-service.test.ts`

**Interfaces:**
- Produces: `liveQuotesByTradeId: Record<string, { price: number; marketTimestamp: string; source: string } | null>`。
- Consumes: 既有 `loadSnapshot(code)` 和 `PaperTradeRepository`。

- [ ] **Step 1: Write the failing test**

```ts
expect(await service.listAllAndSettle("all", "entryTime")).resolves.toMatchObject({
  liveQuotesByTradeId: { "paper-1": { price: 35.75, source: "tencent" } },
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/server/paper-trading/paper-trade-market-service.test.ts`

- [ ] **Step 3: Write minimal implementation**

收集每笔进行中记录快照中的有效报价。单笔加载失败或无报价时映射为 `null`，继续已有自动结算和其他记录加载。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/server/paper-trading/paper-trade-market-service.test.ts`

### Task 2: 手动平仓响应携带更新统计

**Files:**
- Modify: `src/server/paper-trading/paper-trade-market-service.ts`
- Modify: `src/app/api/paper-trades/[id]/close/route.ts`
- Test: `src/server/paper-trading/paper-trade-market-service.test.ts`

**Interfaces:**
- Produces: `closeOpenById(id): Promise<{ trade: PaperTradeRecord; statistics: PaperTradeStatistics }>`。
- Consumes: 既有 `createManualPaperTradeSettlement` 与 `calculatePaperTradeStatistics`。

- [ ] **Step 1: Write the failing test**

```ts
await expect(service.closeOpenById(trade.id)).resolves.toMatchObject({
  trade: { status: "manual_closed", exitPrice: 35.75 },
  statistics: { settledCount: 1 },
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/server/paper-trading/paper-trade-market-service.test.ts`

- [ ] **Step 3: Write minimal implementation**

完成已有的服务端报价结算后重新读取交易记录，计算统计并由动态 ID 路由原样返回。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/server/paper-trading/paper-trade-market-service.test.ts`

### Task 3: 列表组件显示浮盈并局部平仓

**Files:**
- Modify: `src/components/paper-trades/paper-trades-view.tsx`
- Modify: `src/components/paper-trades/paper-trade-list.tsx`
- Test: `src/components/paper-trades/paper-trades-view.test.tsx`

**Interfaces:**
- Consumes: `PaperTradesData.liveQuotesByTradeId` 和平仓响应 `trade/statistics`。
- Produces: 只在进行中记录上显示实时价、浮盈、确认平仓操作。

- [ ] **Step 1: Write the failing test**

```tsx
const html = renderToStaticMarkup(<PaperTradesView initialData={openTradeData} />);
expect(html).toContain("当前价");
expect(html).toContain("+1.23%");
expect(html).toContain("手动平仓");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/paper-trades/paper-trades-view.test.tsx`

- [ ] **Step 3: Write minimal implementation**

为列表行提供报价展示和内联二次确认。确认成功时替换当前项并更新统计；没有价格时显示 `--` 并禁用确认。扩展列表页 `useEffect`，初次请求后仅在 `document.visibilityState === "visible"` 时按 30 秒周期刷新。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/paper-trades/paper-trades-view.test.tsx`

### Task 4: 完整验证

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document behavior**

说明 `/paper-trades` 的可见页 30 秒报价刷新和服务端重新取价平仓原则。

- [ ] **Step 2: Run validations**

Run: `npx tsc --noEmit`, `npm run test -- --exclude ".worktrees/**"`, `npm run lint`, `npm run build -- --webpack`.

- [ ] **Step 3: Manual browser validation**

确认进行中记录显示报价与浮盈、确认平仓不刷新页面、切换隐藏页面后不再轮询，并确认详情页分钟周期与自动刷新未改动。
