# Backtest Engine V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add an isolated, read-only daily-bar backtest workspace at /backtest with three deterministic strategies, an equity curve, performance metrics, and trade records.

**Architecture:** The Backtest history route reads up to 500 completed Tencent daily bars through a new isolated adapter and never accesses the database. Pure functions in src/lib/backtest evaluate historical signals and execute next-open fills using the approved cost model. The client fetches only after explicit form submission and renders the in-memory report with existing Recharts.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, React, Tailwind CSS, Recharts, Tencent local market-data service.

## Global Constraints

- New Backtest code stays in src/app/backtest, src/app/api/backtest, src/components/backtest, src/lib/backtest, and src/types/backtest.ts.
- The only permitted existing UI edit is one /backtest navigation item in src/components/layout/sidebar.tsx.
- GET /api/backtest/history is read-only: no database import, no write-capable repository, and no POST, PUT, PATCH, or DELETE request.
- Use Tencent daily bars only, at most 500 trading days. Do not use Mock data or return a partial report after upstream failure.
- Existing pages, existing API routes, market providers, strategy engine, minute K line, Paper Trade, and data integrity code remain unchanged.
- Signals are evaluated at close and fill only on the following trading day open.
- Apply 100,000 CNY initial capital, 100-share lots, 0.05% slippage each side, 0.03% commission each side with a 5 CNY minimum, and 0.05% sell-side charge.

---

## File Structure

| File | Responsibility |
| --- | --- |
| src/types/backtest.ts | Backtest strategy, request, trade, equity, metric, and API types. |
| src/lib/backtest/backtest-indicators.ts | Safe EMA, rolling high/low, volume, and finite-value helpers. |
| src/lib/backtest/backtest-strategies.ts | Close-of-day breakout, EMA-cross, and trend-swing compatible signals. |
| src/lib/backtest/backtest-engine.ts | Next-open execution, costs, lots, settlement, equity curve, and metrics. |
| src/lib/backtest/backtest-history.ts | Server-only Tencent history reader, normalization, range validation, and filtering. |
| src/app/api/backtest/history/route.ts | GET-only route returning validated history data. |
| src/app/backtest/page.tsx | Backtest route using the existing AppShell. |
| src/components/backtest/backtest-view.tsx | Explicit form submission, fetch, and report lifecycle. |
| src/components/backtest/backtest-view-state.ts | Pure idle/loading/error/empty/report resolver. |
| src/components/backtest/backtest-summary.tsx | Metric cards. |
| src/components/backtest/backtest-equity-chart.tsx | Recharts capital curve. |
| src/components/backtest/backtest-trade-list.tsx | Desktop table and mobile cards. |

## Task 1: Define contracts and deterministic signals

**Files:**
- Create: src/types/backtest.ts
- Create: src/lib/backtest/backtest-indicators.ts
- Create: src/lib/backtest/backtest-strategies.ts
- Test: src/lib/backtest/backtest-strategies.test.ts

**Interfaces:**
- BacktestStrategyId = "breakout" | "ema_cross" | "trend_swing_compatible".
- evaluateBacktestSignal(input: BacktestSignalInput): BacktestSignal.
- BacktestSignal is { entry: boolean; exit: boolean; reason: string | null } and never has entry and exit both true.

- [ ] **Step 1: Write failing strategy tests**

~~~ts
it("emits a breakout entry only after current close exceeds prior N highs", () => {
  expect(evaluateBacktestSignal({
    strategy: "breakout", bars: barsWithBreakoutOnLastDay(), index: 20, breakoutLookback: 20,
  })).toEqual({ entry: true, exit: false, reason: "突破此前20日高点" });
});

it("emits an EMA exit only on downward EMA12/EMA26 crossing", () => {
  expect(evaluateBacktestSignal({
    strategy: "ema_cross", bars: barsWithEmaDeadCrossOnLastDay(), index: 30, breakoutLookback: 20,
  }).exit).toBe(true);
});

it("does not enter a trend swing before 250 daily bars", () => {
  expect(evaluateBacktestSignal({
    strategy: "trend_swing_compatible", bars: makeBars(249), index: 248, breakoutLookback: 20,
  }).reason).toBe("历史数据不足：趋势波段策略需要250个交易日");
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: npx vitest run src/lib/backtest/backtest-strategies.test.ts

Expected: FAIL because the signal module does not exist.

- [ ] **Step 3: Add types and finite indicator helpers**

Define BacktestStrategyId, BacktestSignal, and BacktestSignalInput in src/types/backtest.ts. Implement calculateEma(values, period), previousHighestHigh, previousLowestLow, and averageVolume. Each returns null for insufficient or non-finite input and never returns NaN or Infinity.

- [ ] **Step 4: Implement the three signal rules**

Dispatch from evaluateBacktestSignal to breakout, EMA cross, and trend-swing compatible functions. Breakout compares current close only against bars ending at index minus one; exit uses floor(N / 2) prior lows. EMA compares prior and current EMA12/EMA26 values. Trend swing reads only trendSwingConfig and movingAverages from the existing strategy code; it requires 250 bars, MA20 above MA60, close above MA20, MA20 above its five-day-ago value, positive 20-day return, and volume at least the 20-day average.

- [ ] **Step 5: Run focused tests**

Run: npx vitest run src/lib/backtest/backtest-strategies.test.ts

Expected: PASS for insufficient data, entry, exit, no-signal, and finite indicators.

- [ ] **Step 6: Commit**

~~~powershell
git add src/types/backtest.ts src/lib/backtest/backtest-indicators.ts src/lib/backtest/backtest-strategies.ts src/lib/backtest/backtest-strategies.test.ts
git commit -m "feat: add deterministic backtest signals"
~~~

## Task 2: Build the pure execution engine and report metrics

**Files:**
- Create: src/lib/backtest/backtest-engine.ts
- Test: src/lib/backtest/backtest-engine.test.ts
- Modify: src/types/backtest.ts

**Interfaces:**
- runBacktest(input: RunBacktestInput): BacktestReport.
- RunBacktestInput contains bars, strategy, initialCapital, and breakoutLookback.
- BacktestReport contains initial/final equity, return metrics, completed trade count, equity curve, and completed trades.

- [ ] **Step 1: Write failing execution tests**

~~~ts
it("fills a close-of-day entry only at the following open with slippage and a board lot", () => {
  const report = runBacktest({
    bars: barsWithBreakoutAndNextOpen(10, 11), strategy: "breakout", initialCapital: 100_000, breakoutLookback: 5,
  });
  expect(report.trades[0]).toMatchObject({ entryDate: "2025-01-09", entryPrice: 11.0055, quantity: 9000 });
});

it("does not use a signal-day close as a fill", () => {
  const report = runBacktest({
    bars: barsWithBreakoutAndNextOpen(10, 20), strategy: "breakout", initialCapital: 100_000, breakoutLookback: 5,
  });
  expect(report.trades[0]?.entryPrice).toBeCloseTo(20.01);
});

it("force-settles an open position at the final close", () => {
  const report = runBacktest({
    bars: barsWithOpenPositionAtEnd(), strategy: "ema_cross", initialCapital: 100_000, breakoutLookback: 20,
  });
  expect(report.trades.at(-1)?.exitReason).toBe("区间结算");
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: npx vitest run src/lib/backtest/backtest-engine.test.ts

Expected: FAIL because runBacktest does not exist.

- [ ] **Step 3: Implement queued orders and fixed costs**

Define immutable constants INITIAL_CAPITAL = 100000, LOT_SIZE = 100, SLIPPAGE_RATE = 0.0005, COMMISSION_RATE = 0.0003, MIN_COMMISSION = 5, and SELL_SIDE_RATE = 0.0005. For every bar: execute a queued order at its open; record close equity; evaluate that close; queue an order only for the next bar. Buy size equals floor(cash / (buyPrice * (1 + commissionRate)) / lotSize) * lotSize. A sale subtracts commission and sell-side charge. Do not queue an entry when no valid lot is affordable.

- [ ] **Step 4: Implement metrics and final settlement**

Implement calculateAnnualizedReturn, calculateMaxDrawdown, calculateWinRate, and calculateProfitLossRatio. Use completed trades only for win rate and P/L ratio. P/L ratio is null when no losing trade exists. After normal signal processing, close a remaining position at final close with exit reason 区间结算.

- [ ] **Step 5: Run focused tests**

Run: npx vitest run src/lib/backtest/backtest-engine.test.ts src/lib/backtest/backtest-strategies.test.ts

Expected: PASS for no-lookahead, fees, slippage, lot sizing, insufficient cash, settlement, and report metrics.

- [ ] **Step 6: Commit**

~~~powershell
git add src/types/backtest.ts src/lib/backtest/backtest-engine.ts src/lib/backtest/backtest-engine.test.ts
git commit -m "feat: add backtest execution engine"
~~~

## Task 3: Expose the isolated, read-only history endpoint

**Files:**
- Create: src/lib/backtest/backtest-history.ts
- Test: src/lib/backtest/backtest-history.test.ts
- Create: src/app/api/backtest/history/route.ts
- Test: src/app/api/backtest/history/route.test.ts

**Interfaces:**
- parseBacktestHistoryRequest(url: URL): BacktestHistoryRequest.
- fetchBacktestHistory(request: BacktestHistoryRequest): Promise<BacktestHistoryResponse>.
- GET /api/backtest/history accepts code, start, and end query values.

- [ ] **Step 1: Write failing history tests**

~~~ts
it("uses GET with count=500 and filters the closed date range", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(tencentDailyResponse(500)));
  const result = await fetchBacktestHistory({ code: "002472", start: "2025-01-01", end: "2025-12-31" });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("symbol=002472"), expect.objectContaining({ method: "GET" }));
  expect(result.bars.every((bar) => bar.date >= "2025-01-01" && bar.date <= "2025-12-31")).toBe(true);
});

it("rejects more than 500 filtered trading days instead of truncating", async () => {
  await expect(fetchBacktestHistory({ code: "002472", start: "2023-01-01", end: "2025-12-31" }))
    .rejects.toMatchObject({ code: "BACKTEST_RANGE_TOO_LARGE" });
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: npx vitest run src/lib/backtest/backtest-history.test.ts src/app/api/backtest/history/route.test.ts

Expected: FAIL because the adapter and route do not exist.

- [ ] **Step 3: Implement server-only history reading**

Call only the Tencent GET endpoint with symbol, period=day, and count=500; use TENCENT_SERVICE_BASE_URL with local port 8001 fallback. Validate Shenzhen code prefix, ISO dates, ordered range, upstream success, finite OHLCV, ascending unique dates, and filtered count no greater than 500. Use BacktestHistoryError: 400 for caller input and 502 for unavailable or malformed upstream data. Do not import Prisma, MarketDataService, or any provider/repository.

- [ ] **Step 4: Implement route response**

Return success true with data containing bars, source, updatedAt, and returnedTradingDays. Return safe typed validation errors. Map unknown failures to status 502, code BACKTEST_HISTORY_UNAVAILABLE, and message 历史日线暂时不可用.

- [ ] **Step 5: Run focused tests**

Run: npx vitest run src/lib/backtest/backtest-history.test.ts src/app/api/backtest/history/route.test.ts

Expected: PASS for GET-only behavior, 500-day enforcement, invalid inputs, filtering, upstream failure, and no raw error leakage.

- [ ] **Step 6: Commit**

~~~powershell
git add src/lib/backtest/backtest-history.ts src/lib/backtest/backtest-history.test.ts src/app/api/backtest/history/route.ts src/app/api/backtest/history/route.test.ts
git commit -m "feat: expose read-only backtest history"
~~~

## Task 4: Build the isolated Backtest page and report UI

**Files:**
- Create: src/app/backtest/page.tsx
- Create: src/components/backtest/backtest-view.tsx
- Create: src/components/backtest/backtest-view-state.ts
- Test: src/components/backtest/backtest-view-state.test.ts
- Create: src/components/backtest/backtest-summary.tsx
- Create: src/components/backtest/backtest-equity-chart.tsx
- Create: src/components/backtest/backtest-trade-list.tsx
- Modify: src/components/layout/sidebar.tsx

**Interfaces:**
- BacktestView calls only /api/backtest/history with GET after explicit submit.
- resolveBacktestViewState(input) returns idle, loading, error, empty, or report.
- runBacktest is called only after successful client response validation.

- [ ] **Step 1: Write failing view-state tests**

~~~ts
it("is idle before a user starts a run", () => {
  expect(resolveBacktestViewState({ hasStarted: false, isLoading: false, error: null, report: null })).toBe("idle");
});

it("keeps the prior report while another request is loading", () => {
  expect(resolveBacktestViewState({ hasStarted: true, isLoading: true, error: null, report: completedReport })).toBe("loading");
});

it("renders error only for a failed request", () => {
  expect(resolveBacktestViewState({ hasStarted: true, isLoading: false, error: "历史日线暂时不可用", report: null })).toBe("error");
});
~~~

- [ ] **Step 2: Run the test to verify it fails**

Run: npx vitest run src/components/backtest/backtest-view-state.test.ts

Expected: FAIL because the view-state resolver does not exist.

- [ ] **Step 3: Implement route shell and explicit form**

Make page.tsx an AppShell wrapper around BacktestView. Default code is 002472, strategy is breakout, and N is 20. Validate code, dates, and N before GET. Do not use useEffect for requests. The only command starts the backtest and is disabled while loading.

- [ ] **Step 4: Implement report components**

Render cost assumptions, eight metric cards, a Recharts LineChart over date/equity, and completed trades. Use a desktop table plus responsive mobile cards. Render compact Backtest-only skeleton blocks while loading and retain a prior report. On failure, render inline safe error plus retry; do not use alert, mutation requests, or polling.

- [ ] **Step 5: Add the only permitted navigation entry**

Add exactly { label: "策略回测", href: "/backtest" } to the sidebar navigation array. Do not alter other items, route behavior, or layout classes.

- [ ] **Step 6: Run focused UI tests**

Run: npx vitest run src/components/backtest/backtest-view-state.test.ts

Expected: PASS for idle, loading, error, empty, and report states.

- [ ] **Step 7: Commit**

~~~powershell
git add src/app/backtest/page.tsx src/components/backtest src/components/layout/sidebar.tsx
git commit -m "feat: add backtest workspace"
~~~

## Task 5: Document and verify without affecting existing flows

**Files:**
- Modify: README.md

- [ ] **Step 1: Add concise documentation**

Document /backtest, three strategies, 500-day limit, fixed costs, in-memory-only reports, read-only GET API, and local Tencent service requirement. Do not rewrite unrelated documentation.

- [ ] **Step 2: Run the feature test suite**

Run:

~~~powershell
npx vitest run src/lib/backtest src/app/api/backtest src/components/backtest
~~~

Expected: PASS for deterministic signals, next-open execution, metrics, API validation, GET-only isolation, and UI state.

- [ ] **Step 3: Run full regression checks**

Run:

~~~powershell
npx tsc --noEmit
npm run lint
npm run test -- --exclude ".worktrees/**"
npm run build -- --webpack
~~~

Expected: TypeScript exits 0, lint has no errors, all tests pass, and the webpack production build succeeds.

- [ ] **Step 4: Verify running application**

Open /backtest, submit 002472 with no more than 500 trading days, and verify a successful GET, non-demo daily bars, an equity curve, and completed trade records when signals occur. Then open /stocks/002472, /paper-trades, and /api/market/stocks/002472/minutes?period=1m&limit=5 to confirm existing detail, Paper Trade, and minute K line still work.

- [ ] **Step 5: Commit**

~~~powershell
git add README.md
git commit -m "docs: describe backtest workspace"
~~~

## Plan Self-Review

- Spec coverage: Tasks 1-2 cover the three strategies, next-open fills, capital, lots, costs, settlement, metrics, and no-lookahead. Task 3 covers the isolated GET-only 500-day history interface. Task 4 covers the page, controls, Recharts, responsive records, loading/error states, and the sole allowed existing UI edit. Task 5 covers documentation and regression checks.
- Placeholder scan: no unfinished markers, deferred work, or unspecified error paths remain.
- Type consistency: BacktestStrategyId, BacktestSignalInput, BacktestSignal, RunBacktestInput, BacktestReport, BacktestHistoryRequest, and BacktestHistoryResponse are introduced before their consumers and remain within the new module.
