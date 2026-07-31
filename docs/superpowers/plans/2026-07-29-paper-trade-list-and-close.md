# 模拟交易列表与手动平仓 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增模拟交易列表、统一统计和仅以服务端真实报价结算的手动平仓能力。

**Architecture:** 保留 `PaperTrade` 作为唯一模拟交易存储模型。服务端 repository/service 负责查询、自动结算、统计和手动结算；Next API 只接受筛选参数或记录 ID，禁止客户端传入卖出价格。列表页和详情页分别调用这些 API，不影响分钟 K 线与其刷新机制。

**Tech Stack:** Next.js App Router、TypeScript、React、Prisma、SQLite、Vitest、Tailwind CSS。

## Global Constraints

- 所有记录固定为模拟交易，不连接券商、不提交订单。
- 手动平仓仅采用服务端实时真实报价；不可用时保持 `open`。
- 不修改策略、真实报价来源、分钟 K 线或自动刷新实现。
- SQLite 迁移只能新增/扩展，不执行 reset，不删除既有数据。
- 统计只使用已结算交易；累计收益率是已结算收益率的算术和。

---

## File structure

- Modify `prisma/schema.prisma`: 增加 `manual_closed` 状态。
- Create `prisma/migrations/<timestamp>_add_paper_trade_manual_closed/migration.sql`: 安全扩展 SQLite 状态约束并保留数据。
- Modify `src/server/paper-trading/paper-trade-settlement.ts`: 导出统一状态类型与手动结算构造器。
- Modify `src/server/paper-trading/paper-trade-repository.ts`: 提供按筛选查询、按 ID 查询和手动结算持久化。
- Create `src/server/paper-trading/paper-trade-statistics.ts`: 纯函数统计、筛选和排序。
- Modify `src/server/paper-trading/paper-trade-market-service.ts`: 对全部 open 记录结算、列表查询与手动平仓。
- Modify `src/server/paper-trading/paper-trade-runtime.ts`: 加载平仓所需的实时真实报价。
- Modify `src/app/api/paper-trades/route.ts`; create `src/app/api/paper-trades/[id]/close/route.ts`。
- Create `src/app/paper-trades/page.tsx` 和 `src/components/paper-trades/*`。
- Modify `src/components/layout/sidebar.tsx` 与 `src/components/stocks/detail/paper-trade-panel.tsx`。

## Task 1: 状态模型与结算纯函数

**Files:** `prisma/schema.prisma`, 新迁移、`src/server/paper-trading/paper-trade-settlement.ts`、其测试。

**Interfaces:**
- `PaperTradeStatus = "open" | "take_profit" | "stop_loss" | "expired" | "manual_closed"`
- `createManualPaperTradeSettlement(trade, exitPrice): PaperTradeSettlement`

- [ ] 写失败测试：

```ts
it("creates a manual settlement from the server quote", () => {
  expect(createManualPaperTradeSettlement(trade, 12)).toMatchObject({
    status: "manual_closed", exitPrice: 12, returnPercent: 20, settlementReason: "manual_closed",
  });
});
```

- [ ] 运行 `npx vitest run src/server/paper-trading/paper-trade-settlement.test.ts`，确认因函数缺失失败。
- [ ] 扩展 Prisma 枚举、生成保留既有数据的迁移，并最小实现手动结算：写入 `manual_closed`、服务端卖出价和两位小数收益率。
- [ ] 执行 `npx prisma generate && npx prisma migrate deploy`，再运行上述测试确认通过。
- [ ] 提交仅包含本任务文件：`git commit -m "feat: support manual paper trade close"`。

## Task 2: repository、列表统计与服务层

**Files:** `paper-trade-repository.ts`、新建 `paper-trade-statistics.ts` 与其测试、`paper-trade-market-service.ts` 及其测试。

**Interfaces:**
- `list({ status, sort }): Promise<PaperTradeRecord[]>`
- `findOpenById(id): Promise<PaperTradeRecord | null>`
- `PaperTradeStatistics { totalCount; settledCount; winRate; totalReturnPercent; averageReturnPercent }`
- `closeOpenById(id, market): Promise<PaperTradeRecord>`

- [ ] 写失败测试：

```ts
expect(calculatePaperTradeStatistics([winningTrade, losingTrade, openTrade])).toEqual({
  totalCount: 3, settledCount: 2, winRate: 50, totalReturnPercent: 5, averageReturnPercent: 2.5,
});
await service.closeOpenById("open-id", { latestQuotePrice: 11, settledAt: timestamp });
expect(repository.settle).toHaveBeenCalledWith("open-id", expect.objectContaining({
  status: "manual_closed", exitPrice: 11,
}), timestamp);
```

- [ ] 运行 `npx vitest run src/server/paper-trading/paper-trade-statistics.test.ts src/server/paper-trading/paper-trade-market-service.test.ts`，确认失败。
- [ ] 实现已结算状态集合、统计、全局列表自动结算、筛选/排序和只允许 `open` 的手动平仓。报价无效、记录不存在或已结算时不写入数据库。
- [ ] 重跑测试确认通过。
- [ ] 提交：`git commit -m "feat: add paper trade statistics and close service"`。

## Task 3: API 契约与错误边界

**Files:** 修改 `src/app/api/paper-trades/route.ts`；创建 `src/app/api/paper-trades/[id]/close/route.ts` 及路由测试。

**Interfaces:**
- `GET /api/paper-trades?status=all|open|closed&sort=entryTime|exitTime|returnPercent`
- `POST /api/paper-trades/[id]/close`
- 错误：`PAPER_TRADE_NOT_FOUND`、`PAPER_TRADE_NOT_OPEN`、`PAPER_TRADE_QUOTE_UNAVAILABLE`。

- [ ] 写失败测试，证明 close 路由忽略客户端 `exitPrice`，已结算记录返回 409。
- [ ] 运行 `npx vitest run src/app/api/paper-trades/route.test.ts src/app/api/paper-trades/[id]/close/route.test.ts`，确认失败。
- [ ] 白名单校验 `status` 和 `sort`；默认按买入时间倒序。close 路由只读 ID，由运行时服务加载实时真实报价；未知异常只返回 `PAPER_TRADE_UNAVAILABLE`。
- [ ] 重跑路由测试确认通过。
- [ ] 提交：`git commit -m "feat: expose paper trade list and close APIs"`。

## Task 4: 模拟交易列表页面与导航

**Files:** 创建 `src/app/paper-trades/page.tsx`、`src/components/paper-trades/paper-trades-view.tsx`、`paper-trade-filters.tsx`、`paper-trade-statistics.tsx`、`paper-trade-list.tsx` 与组件测试；修改 `src/components/layout/sidebar.tsx`。

**Interfaces:** View 消费 `{ trades, statistics, latestQuoteTimestamp }`；筛选为 `all|open|closed`，排序为 `entryTime|exitTime|returnPercent`。

- [ ] 写失败测试：

```tsx
render(<PaperTradesView initialData={fixture} />);
expect(screen.getByRole("link", { name: /002472/ })).toHaveAttribute("href", "/stocks/002472");
expect(screen.getByRole("button", { name: "进行中" })).toBeInTheDocument();
expect(screen.getByText("胜率")).toBeInTheDocument();
```

- [ ] 运行组件测试，确认失败。
- [ ] 实现标题、模拟说明、三种筛选、三种排序、四项已实现统计、股票详情链接和无记录空状态；导航增加 `/paper-trades`。
- [ ] 重跑组件测试确认通过。
- [ ] 提交：`git commit -m "feat: add paper trade ledger page"`。

## Task 5: 详情页手动平仓与回归验证

**Files:** 修改 `src/components/stocks/detail/paper-trade-panel.tsx` 与测试；修改 `README.md`。

**Interfaces:** `POST /api/paper-trades/${trade.id}/close` 不使用客户端价格；确认控件仅对 `open` 记录可见。

- [ ] 写失败测试：

```tsx
await user.click(await screen.findByRole("button", { name: "手动平仓" }));
expect(screen.getByText(/当前服务器报价/)).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "确认平仓" }));
expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/paper-trades\/open-id\/close$/), expect.objectContaining({ method: "POST" }));
```

- [ ] 运行 `npx vitest run src/components/stocks/detail/paper-trade-panel.test.tsx`，确认失败。
- [ ] 实现仅 open 可见的“手动平仓”、二次确认、安全错误提示、成功后刷新与重新启用模拟买入；请求不传价格。补充 README。
- [ ] 执行完整验证：

```bash
npx prisma generate
npx prisma migrate deploy
npx tsc --noEmit
npm run lint
npm run test -- --exclude ".worktrees/**"
npm run build -- --webpack
```

- [ ] 手动验证 `/paper-trades`、`/stocks/002472`、列表 API、close API，及 `/api/market/stocks/002472/minutes?period=1m&limit=30`。
- [ ] 提交：`git commit -m "feat: add manual paper trade close"`.

