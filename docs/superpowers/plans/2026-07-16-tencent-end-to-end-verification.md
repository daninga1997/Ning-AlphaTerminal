# 腾讯报价端到端验证 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改动终端主页面的前提下，证明腾讯报价可从 FastAPI 经 Next.js 同源 API 显示到独立验收页。

**Architecture:** Python 服务继续承担腾讯公开报价请求与字段标准化；Next.js 继续仅通过 `MarketDataService` 和 `TencentProvider` 访问服务。新增的 `/test-tencent` 页面不直连腾讯上游，而是请求既有 `/api/market/quotes`，以验证完整生产调用路径。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Vitest、FastAPI、requests。

## Global Constraints

- 仅处理 `C:\Projects\AlphaTerminal`。
- 不修改 Dashboard、Watchlist、Stock Detail、评分和策略逻辑。
- 不新增数据源；不将失败结果替换成 Mock 数据。
- 腾讯服务端口固定为 `8001`，Next.js 通过 `TENCENT_SERVICE_BASE_URL` 访问它。
- 本次不提交 Git：工作区已有与本任务无关的未提交改动，且用户未要求创建提交。

---

## File Structure

- Create: `src/components/tencent-quote-test/tencent-quote-validation.ts` — 纯函数，判定响应是否为可验证的腾讯真实报价。
- Create: `src/components/tencent-quote-test/tencent-quote-validation.test.ts` — 验证真实、Mock、空报价和错误响应的判定。
- Create: `src/app/test-tencent/page.tsx` — 唯一的验收页面，调用同源 Next API 并展示结果。
- Modify: `.env` — 仅本地把 `MARKET_DATA_MODE` 设为 `live`；该文件不纳入 Git。

### Task 1: 验证腾讯服务的运行前提

**Files:**
- Inspect: `services/tencent-service/app/main.py`
- Inspect: `services/tencent-service/app/quote_parser.py`

**Consumes:** `GET /health` 与 `GET /quotes?codes=002472,002317`。

**Produces:** 一个已启动的 `127.0.0.1:8001` FastAPI 服务，且两只股票报价可由服务返回。

- [x] **Step 1: 启动腾讯 FastAPI 服务**

Run:

```powershell
Set-Location C:\Projects\AlphaTerminal\services\tencent-service
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Expected: Uvicorn reports `running on http://127.0.0.1:8001`.

- [x] **Step 2: 验证服务健康状态**

Run:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
```

Expected: JSON contains `provider: "tencent"` and no Python traceback.

- [x] **Step 3: 验证两个报价**

Run:

```powershell
Invoke-RestMethod 'http://127.0.0.1:8001/quotes?codes=002472,002317'
```

Expected: `success` is `true`; both codes appear in `data`; each `price` is a finite positive number; each `isDemo` is `false`; each `source` is `tencent`.

- [x] **Step 4: 记录失败层级而不伪造数据**

If the request fails, retain the service response error code or startup error and stop before changing frontend code. Do not add a fallback to mock quote data.

### Task 2: 建立纯验证规则与测试

**Files:**
- Create: `src/components/tencent-quote-test/tencent-quote-validation.ts`
- Test: `src/components/tencent-quote-test/tencent-quote-validation.test.ts`

**Consumes:** `MarketDataResult<StockQuote[]>` from `@/types/market-data`.

**Produces:** `assessTencentQuoteResponse(response: TencentQuoteApiResponse): TencentQuoteVerification`.

- [x] **Step 1: 写入失败测试**

Create `src/components/tencent-quote-test/tencent-quote-validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assessTencentQuoteResponse, type TencentQuoteApiResponse } from "./tencent-quote-validation";

const valid: TencentQuoteApiResponse = {
  success: true,
  data: [{
    code: "002472", name: "双环传动", exchange: "SZSE", price: 42.39,
    previousClose: 40, open: 41, high: 43, low: 40.5, change: 2.39,
    changePercent: 5.98, volume: 100000, amount: 4239000, turnoverRate: 1.2,
    volumeRatio: 1.1, bidPrice: 42.39, askPrice: 42.4,
    marketTimestamp: "2026-07-16T10:00:00+08:00", receivedAt: "2026-07-16T10:00:01+08:00",
    status: "fresh", source: "tencent", isDemo: false,
  }],
  meta: {
    source: "tencent", status: "fresh", marketTimestamp: "2026-07-16T10:00:00+08:00",
    receivedAt: "2026-07-16T10:00:01+08:00", isDemo: false, mode: "live",
  },
};

describe("assessTencentQuoteResponse", () => {
  it("accepts a non-demo Tencent quote with a positive finite price", () => {
    expect(assessTencentQuoteResponse(valid)).toEqual({ ok: true, reason: null });
  });

  it("rejects a mock response", () => {
    expect(assessTencentQuoteResponse({ ...valid, meta: { ...valid.meta, isDemo: true } })).toEqual({ ok: false, reason: "演示数据不能作为腾讯链路验收结果" });
  });

  it("rejects a non-Tencent source", () => {
    expect(assessTencentQuoteResponse({ ...valid, meta: { ...valid.meta, source: "eastmoney" } })).toEqual({ ok: false, reason: "数据来源不是腾讯" });
  });

  it("rejects an empty or invalid quote list", () => {
    expect(assessTencentQuoteResponse({ ...valid, data: [] })).toEqual({ ok: false, reason: "未返回有效报价" });
    expect(assessTencentQuoteResponse({ ...valid, data: [{ ...valid.data[0], price: Number.NaN }] })).toEqual({ ok: false, reason: "报价价格无效" });
  });

  it("keeps safe API error messages", () => {
    expect(assessTencentQuoteResponse({ success: false, error: { code: "MARKET_DATA_ERROR", message: "行情数据服务异常" } })).toEqual({ ok: false, reason: "行情数据服务异常" });
  });
});
```

- [x] **Step 2: 运行测试确认失败**

Run:

```powershell
npm.cmd run test -- src/components/tencent-quote-test/tencent-quote-validation.test.ts
```

Expected: FAIL because `tencent-quote-validation` does not exist.

- [x] **Step 3: 实现最小纯函数**

Create `src/components/tencent-quote-test/tencent-quote-validation.ts`:

```ts
import type { MarketDataFailure, MarketDataSuccess, StockQuote } from "@/types/market-data";

export type TencentQuoteApiResponse = MarketDataSuccess<StockQuote[]> | MarketDataFailure;

export type TencentQuoteVerification = { ok: boolean; reason: string | null };

export function assessTencentQuoteResponse(response: TencentQuoteApiResponse): TencentQuoteVerification {
  if (!response.success) return { ok: false, reason: response.error.message };
  if (response.meta.isDemo) return { ok: false, reason: "演示数据不能作为腾讯链路验收结果" };
  if (response.meta.source !== "tencent") return { ok: false, reason: "数据来源不是腾讯" };
  if (response.data.length === 0) return { ok: false, reason: "未返回有效报价" };
  if (response.data.some((quote) => quote.isDemo || quote.source !== "tencent")) return { ok: false, reason: "报价来源不是腾讯真实数据" };
  if (response.data.some((quote) => !Number.isFinite(quote.price) || quote.price <= 0)) return { ok: false, reason: "报价价格无效" };
  return { ok: true, reason: null };
}
```

- [x] **Step 4: 运行单元测试确认通过**

Run:

```powershell
npm.cmd run test -- src/components/tencent-quote-test/tencent-quote-validation.test.ts
```

Expected: PASS with five passing tests.

### Task 3: 新增同源腾讯验收页

**Files:**
- Create: `src/app/test-tencent/page.tsx`

**Consumes:** `GET /api/market/quotes?codes=002472,002317` and `assessTencentQuoteResponse`.

**Produces:** `/test-tencent` showing the actual API payload and verification result without modifying existing product pages.

- [x] **Step 1: 创建客户端验收页**

Create `src/app/test-tencent/page.tsx` with this structure:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { StockQuote } from "@/types/market-data";
import { assessTencentQuoteResponse, type TencentQuoteApiResponse } from "@/components/tencent-quote-test/tencent-quote-validation";

const url = "/api/market/quotes?codes=002472,002317";

export default function TencentVerificationPage() {
  const [response, setResponse] = useState<TencentQuoteApiResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(url, { cache: "no-store" })
      .then(async (result) => {
        const payload = (await result.json()) as TencentQuoteApiResponse;
        if (!result.ok) throw new Error(payload.success ? "行情请求失败" : payload.error.message);
        setResponse(payload);
      })
      .catch(() => setRequestError("Next 到腾讯服务不可用"));
  }, []);

  const verification = response ? assessTencentQuoteResponse(response) : null;
  const quotes = response?.success ? response.data : [];

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10 text-[#F4F7FB]">
      <header><h1 className="text-2xl font-semibold">腾讯报价端到端验证</h1><p className="mt-2 text-sm text-[#8B95A7]">仅用于确认 FastAPI、Next.js API 与浏览器展示链路；不修改交易终端主页面。</p></header>
      <section className="rounded-lg border border-[#252A33] bg-[#111318] p-5">
        <p className={verification?.ok ? "text-[#33C481]" : "text-[#FF7070]"}>{verification ? (verification.ok ? "验证通过：腾讯真实报价已到达前端" : `验证未通过：${verification.reason}`) : requestError ?? "正在请求同源行情 API…"}</p>
        {response?.success && <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-[#8B95A7]">来源</dt><dd>{response.meta.source}</dd></div><div><dt className="text-[#8B95A7]">模式</dt><dd>{response.meta.mode ?? "-"}</dd></div><div><dt className="text-[#8B95A7]">状态</dt><dd>{response.meta.status}</dd></div><div><dt className="text-[#8B95A7]">服务接收时间</dt><dd>{response.meta.receivedAt}</dd></div></dl>}
      </section>
      <section className="grid gap-4 sm:grid-cols-2">{quotes.map((quote: StockQuote) => <article key={quote.code} className="rounded-lg border border-[#252A33] bg-[#111318] p-5"><p className="text-sm text-[#8B95A7]">{quote.code}</p><h2 className="mt-1 text-lg font-semibold">{quote.name}</h2><p className="mt-5 text-2xl font-semibold">{quote.price.toFixed(2)}</p><p className="mt-1 text-sm text-[#8B95A7]">涨跌幅 {quote.changePercent.toFixed(2)}% · {quote.marketTimestamp}</p></article>)}</section>
      {response && <pre className="overflow-x-auto rounded-lg border border-[#252A33] bg-[#090A0D] p-5 text-xs text-[#C7CEDA]">{JSON.stringify(response, null, 2)}</pre>}
    </main>
  );
}
```

- [x] **Step 2: 确认页面只使用同源 API**

Run:

```powershell
rg -n "127\.0\.0\.1|qt\.gtimg|/api/market/quotes" src\app\test-tencent\page.tsx
```

Expected: output contains only `/api/market/quotes?codes=002472,002317`.

### Task 4: 启用本地 live 模式并执行端到端验收

**Files:**
- Modify: `.env`
- Inspect: `src/app/api/market/quotes/route.ts`

**Consumes:** running FastAPI service, Tencent Provider, `/test-tencent`.

**Produces:** local Next.js request path receiving Tencent data with `mode: "live"`.

- [x] **Step 1: 修改本地环境配置**

In `.env`, set exactly:

```dotenv
MARKET_DATA_MODE=live
TENCENT_SERVICE_BASE_URL=http://127.0.0.1:8001
```

Keep `DATABASE_URL` unchanged. Do not alter `.env.example` and do not commit `.env`.

- [x] **Step 2: 重启 Next.js 开发服务器**

Run:

```powershell
npm.cmd run dev
```

Expected: server listens on `http://localhost:3000` after reading the updated environment.

- [x] **Step 3: 验证 Next.js API 代理**

Run:

```powershell
Invoke-RestMethod 'http://localhost:3000/api/market/quotes?codes=002472,002317'
```

Expected: `success` is `true`; `meta.mode` is `live`; `meta.source` is `tencent`; neither quote has `isDemo: true`.

- [x] **Step 4: 验证浏览器验收页**

Open:

```text
http://localhost:3000/test-tencent
```

Expected: two stock cards have positive prices; status area says `验证通过：腾讯真实报价已到达前端`; raw JSON reports `source: "tencent"` and `isDemo: false`.

### Task 5: 回归验证与交付

**Files:**
- Inspect: `src/components/tencent-quote-test/tencent-quote-validation.ts`
- Inspect: `src/app/test-tencent/page.tsx`

**Consumes:** completed tasks 1–4.

**Produces:** evidence that the isolated page is valid and no existing product page was edited.

- [x] **Step 1: 运行类型检查**

Run:

```powershell
npx.cmd tsc --noEmit
```

Expected: exit code 0.

- [x] **Step 2: 运行 lint**

Run:

```powershell
npm.cmd run lint
```

Expected: exit code 0.

- [x] **Step 3: 运行完整前端测试**

Run:

```powershell
npm.cmd run test
```

Expected: exit code 0, including `tencent-quote-validation.test.ts`.

- [x] **Step 4: 运行生产构建**

Run:

```powershell
npm.cmd run build -- --webpack
```

Expected: exit code 0 and `/test-tencent` is included in the route output.

- [x] **Step 5: 检查变更范围**

Run:

```powershell
git diff -- .env src/app/test-tencent src/components/tencent-quote-test docs/superpowers
git status --short
```

Expected: only the planned new verification files, local `.env` configuration, and planning documents are attributable to this work; do not stage or commit unrelated existing changes.
