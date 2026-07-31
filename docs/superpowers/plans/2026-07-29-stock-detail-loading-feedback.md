# Stock Detail Loading Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `/stocks/[code]` 提供稳定的骨架屏、局部加载反馈、错误边界和空数据提示。

**Architecture:** 使用 App Router 的 `loading.tsx` 覆盖首次详情页导航，使用 `error.tsx` 捕获该路由段服务端渲染错误。分钟趋势和模拟交易保留已有数据请求路径，只在组件内为加载、失败和空数据增加明确状态，避免全页闪烁或改变既有分钟自动刷新。

**Tech Stack:** Next.js 16 App Router、React、TypeScript、Tailwind CSS、Recharts、Vitest。

## Global Constraints

- 仅修改 `/stocks/[code]` 与详情专属组件。
- 不修改 Dashboard、Watchlist、Reports、Settings。
- 不改变分钟 K 线数据来源、可选周期、30 秒自动刷新规则或 Replay 行为。
- 不改变模拟交易持久化、买入、平仓或结算规则。
- 不使用浏览器原生 `alert`；失败反馈必须出现在终端页面或组件内。

---

### Task 1: 详情页路由骨架

**Files:**
- Create: `src/components/stocks/detail/stock-detail-skeleton.tsx`
- Create: `src/components/stocks/detail/stock-detail-skeleton.test.tsx`
- Create: `src/app/stocks/[code]/loading.tsx`

**Interfaces:**
- Produces: `StockDetailSkeleton`，无 props 的深色终端详情页占位组件。
- Consumes: 现有详情页的卡片颜色和布局层级。

- [ ] **Step 1: Write the failing test**

```tsx
const html = renderToStaticMarkup(<StockDetailSkeleton />);
expect(html).toContain('data-testid="stock-detail-loading"');
expect(html).toContain('交易计划');
expect(html).toContain('模拟交易');
expect(html).toContain('价格走势');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/stocks/detail/stock-detail-skeleton.test.tsx`

- [ ] **Step 3: Write minimal implementation**

创建骨架组件，用 `animate-pulse` 的无语义数值占位模拟决策头、交易计划指标、模拟交易、评分、技术快照与图表区域。`loading.tsx` 在 `AppShell` 内渲染它。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/stocks/detail/stock-detail-skeleton.test.tsx`

### Task 2: 分钟线局部加载与空数据状态

**Files:**
- Modify: `src/components/stocks/detail/minute-trend-panel.tsx`
- Create: `src/components/stocks/detail/minute-trend-panel.test.tsx`

**Interfaces:**
- Produces: `getMinuteTrendViewState({ isLoading, response })`，返回 `loading | error | empty | chart`。
- Consumes: 既有 `MinuteApiResponse`、`buildMinuteRequestUrl` 和自动刷新状态。

- [ ] **Step 1: Write the failing test**

```ts
expect(getMinuteTrendViewState({ isLoading: true, response: null })).toBe('loading');
expect(getMinuteTrendViewState({ isLoading: false, response: { success: true, data: [] } })).toBe('empty');
expect(getMinuteTrendViewState({ isLoading: false, response: { success: false } })).toBe('error');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/stocks/detail/minute-trend-panel.test.tsx`

- [ ] **Step 3: Write minimal implementation**

为初始请求与周期切换维护加载状态。加载时渲染图表框架骨架；失败时保留既有区域内真实分钟数据不可用提示；成功但空数组时渲染“暂无数据”卡片，不创建 `LineChart` 或 `BarChart`。自动刷新继续只在既有条件下驱动 `refreshRevision`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/stocks/detail/minute-trend-panel.test.tsx`

### Task 3: 模拟交易加载与失败反馈

**Files:**
- Modify: `src/components/stocks/detail/paper-trade-panel.tsx`
- Modify: `src/components/stocks/detail/paper-trade-panel.test.tsx`

**Interfaces:**
- Produces: 初次交易记录读取期间的局部骨架，以及保留旧数据的刷新失败反馈。
- Consumes: 现有 `refresh()`、买入和手动平仓 API。

- [ ] **Step 1: Write the failing test**

```tsx
const html = renderToStaticMarkup(<PaperTradePanel code="002472" />);
expect(html).toContain('data-testid="paper-trade-loading"');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/stocks/detail/paper-trade-panel.test.tsx`

- [ ] **Step 3: Write minimal implementation**

用 `isLoading` 区分首次读取和已有数据刷新。首次读取时在面板主体渲染骨架并禁用交易按钮；刷新失败时保留已读数据，只写入一条 `aria-live` 组件内消息；买入与平仓的错误消息维持原有语义。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/stocks/detail/paper-trade-panel.test.tsx`

### Task 4: 详情错误边界与完整回归

**Files:**
- Create: `src/app/stocks/[code]/error.tsx`
- Create: `src/app/stocks/[code]/error.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Produces: Next.js 详情页路由段错误边界，接收 `reset(): void` 并渲染重试按钮。

- [ ] **Step 1: Write the failing test**

```tsx
const html = renderToStaticMarkup(<StockDetailError error={new Error('x')} reset={() => {}} />);
expect(html).toContain('详情页暂时无法加载');
expect(html).toContain('重新加载');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/app/stocks/[code]/error.test.tsx`

- [ ] **Step 3: Write minimal implementation**

建立客户端 `error.tsx`，不显示原始错误细节，仅提供当前段重试按钮。README 说明详情页骨架、局部空状态和组件内错误反馈的行为。

- [ ] **Step 4: Run test to verify it passes and run final checks**

Run: `npm run test -- --exclude ".worktrees/**"`, `npx tsc --noEmit`, `npm run lint`, `npm run build -- --webpack`。
