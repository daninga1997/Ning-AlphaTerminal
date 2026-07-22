# 深圳主板股票搜索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户可以在终端按名称或代码检索深圳主板股票，并以研究模式查看真实行情，不改变 20 只核心策略观察池。

**Architecture:** 搜索候选经现有腾讯服务新增的 `/search` 路由取得，使用腾讯同一公开上游的候选数据并只保留 `sz`、`000`、`001`、`002` 开头的股票。Next.js 将其封装为独立搜索 API；非核心股票使用专用研究详情模型，绝不构造评分、信号或交易计划。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Vitest、FastAPI、requests、现有腾讯行情服务。

## Global Constraints

- 仅允许 `000`、`001`、`002` 开头的深圳主板股票；其余市场必须明确拒绝。
- 只使用现有腾讯服务和腾讯公开上游，不接入新的供应商。
- 20 只核心池仍是唯一可进入评分、策略、报告和交易计划的股票范围。
- 外部搜索股票是研究模式：不显示策略 buy、不生成或保存交易计划。
- 报价、日线与演示/回放必须明确区分；上游失败不能伪装为 Mock 真实数据。
- 不修改评分算法、策略规则、Dashboard、Reports、Settings 或核心观察池范围。

---

### Task 1: 腾讯服务的深圳主板候选搜索

**Files:**
- Create: `services/tencent-service/app/search_parser.py`
- Create: `services/tencent-service/tests/test_search_parser.py`
- Modify: `services/tencent-service/app/main.py`

**Interfaces:**
- Consumes: 腾讯候选响应中的 `v_hint="..."` 文本。
- Produces: `parse_szse_mainboard_hints(payload: str, limit: int = 10) -> list[dict[str, str]]`。
- Produces: `GET /search?query=<keyword>`，结果项只有 `code`、`name`、`exchange`、`source`。

- [ ] **Step 1: 写入失败测试**

```python
from app.search_parser import parse_szse_mainboard_hints

def test_keeps_only_szse_mainboard_results():
    raw = 'v_hint="sz~002594~比亚迪~byd~GP-A^sh~600519~贵州茅台~mt~GP-A^sz~300750~宁德时代~ndsd~GP-A"'
    assert parse_szse_mainboard_hints(raw) == [
        {"code": "002594", "name": "比亚迪", "exchange": "SZSE", "source": "tencent_smartbox"},
    ]

def test_returns_empty_list_for_missing_or_unsupported_hints():
    assert parse_szse_mainboard_hints('v_hint="hk~01211~比亚迪股份~byd~GP"') == []
    assert parse_szse_mainboard_hints("") == []
```

- [ ] **Step 2: 运行失败测试**

Run: `services/tencent-service/.venv/Scripts/python.exe -m pytest services/tencent-service/tests/test_search_parser.py -q`

Expected: FAIL，模块 `app.search_parser` 不存在。

- [ ] **Step 3: 实现纯解析器**

```python
import re
from typing import TypedDict

_HINT_PATTERN = re.compile(r'v_hint="(?P<hints>.*)"', re.DOTALL)
_SZSE_MAINBOARD = re.compile(r"^(000|001|002)\d{3}$")

class SearchCandidate(TypedDict):
    code: str
    name: str
    exchange: str
    source: str

def parse_szse_mainboard_hints(payload: str, limit: int = 10) -> list[SearchCandidate]:
    match = _HINT_PATTERN.search(payload)
    if not match:
        return []
    results: list[SearchCandidate] = []
    seen: set[str] = set()
    for hint in match.group("hints").split("^"):
        fields = hint.split("~")
        if len(fields) < 3:
            continue
        market, code, name = fields[0].lower(), fields[1], fields[2]
        if market != "sz" or not _SZSE_MAINBOARD.fullmatch(code) or code in seen:
            continue
        seen.add(code)
        results.append({"code": code, "name": name, "exchange": "SZSE", "source": "tencent_smartbox"})
        if len(results) == limit:
            break
    return results
```

- [ ] **Step 4: 新增受限搜索路由**

在 `main.py` 导入 `parse_szse_mainboard_hints` 并新增：

```python
@app.get("/search")
async def search_stocks(query: str = Query(..., min_length=1, max_length=30)):
    keyword = query.strip()
    if not keyword:
        return {"success": False, "error": {"code": "EMPTY_QUERY", "message": "搜索关键词不能为空"}}
    try:
        response = await asyncio.to_thread(
            requests.get,
            "https://smartbox.gtimg.cn/s3/",
            params={"q": keyword, "t": "all"},
            timeout=8,
        )
        response.raise_for_status()
        return {
            "success": True,
            "data": parse_szse_mainboard_hints(response.text),
            "meta": {"source": "tencent_smartbox", "market": "SZSE", "scope": "mainboard", "received_at": datetime.now(SHANGHAI).isoformat()},
        }
    except requests.RequestException:
        return {"success": False, "error": {"code": "UPSTREAM_UNAVAILABLE", "message": "股票搜索服务暂不可用"}}
```

- [ ] **Step 5: 验证并提交**

Run: `services/tencent-service/.venv/Scripts/python.exe -m pytest services/tencent-service/tests/test_search_parser.py -q`

Expected: PASS。

Run: `Invoke-RestMethod 'http://127.0.0.1:8001/search?query=%E6%AF%94%E4%BA%9A%E8%BF%AA'`

Expected: 返回 `002594`、`比亚迪`，不含沪市、创业板或港股。

```powershell
git add services/tencent-service/app/main.py services/tencent-service/app/search_parser.py services/tencent-service/tests/test_search_parser.py
git commit -m "feat: add Shenzhen mainboard stock search endpoint"
```

### Task 2: Next.js 搜索类型、服务与安全 API

**Files:**
- Create: `src/types/stock-search.ts`
- Create: `src/server/market-data/tencent-stock-search-service.ts`
- Create: `src/server/market-data/tencent-stock-search-service.test.ts`
- Create: `src/app/api/market/search/route.ts`

**Interfaces:**
- Consumes: 腾讯服务 `/search` 的 JSON。
- Produces: `StockSearchCandidate`、`StockSearchResponse`、`TencentStockSearchService.search(query)`。
- Produces: `GET /api/market/search?q=<keyword>`。

- [ ] **Step 1: 写服务失败测试**

```ts
import { expect, it, vi } from "vitest";
import { TencentStockSearchService } from "./tencent-stock-search-service";

it("maps Tencent results and filters non-mainboard candidates", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    success: true,
    data: [
      { code: "002594", name: "比亚迪", exchange: "SZSE", source: "tencent_smartbox" },
      { code: "300750", name: "宁德时代", exchange: "SZSE", source: "tencent_smartbox" },
    ],
  })));
  const service = new TencentStockSearchService({ fetchImpl, baseUrl: "http://search.test" });
  await expect(service.search("比亚迪")).resolves.toEqual({
    success: true,
    data: [{ code: "002594", name: "比亚迪", exchange: "SZSE", source: "tencent_smartbox" }],
  });
});
```

- [ ] **Step 2: 运行失败测试**

Run: `npx vitest run src/server/market-data/tencent-stock-search-service.test.ts`

Expected: FAIL，服务模块不存在。

- [ ] **Step 3: 实现类型、服务和 API**

```ts
export type StockSearchCandidate = {
  code: string;
  name: string;
  exchange: "SZSE";
  source: "tencent_smartbox";
};

export type StockSearchResponse =
  | { success: true; data: StockSearchCandidate[] }
  | { success: false; error: { code: "EMPTY_QUERY" | "UPSTREAM_UNAVAILABLE"; message: string } };
```

服务构造器接收 `{ baseUrl?: string; fetchImpl?: typeof fetch }`。空输入返回 `EMPTY_QUERY`；HTTP 异常、无效 JSON、上游错误统一映射为 `UPSTREAM_UNAVAILABLE`。返回前再次使用 `/^(000|001|002)\d{3}$/` 和 `exchange === "SZSE"` 过滤。

路由实现：

```ts
import { NextResponse } from "next/server";
import { TencentStockSearchService } from "@/server/market-data/tencent-stock-search-service";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const result = await new TencentStockSearchService().search(query);
  return NextResponse.json(result, { status: result.success ? 200 : result.error.code === "EMPTY_QUERY" ? 400 : 503 });
}
```

- [ ] **Step 4: 验证并提交**

Run: `npx vitest run src/server/market-data/tencent-stock-search-service.test.ts`

Expected: PASS。

Run: `Invoke-RestMethod 'http://localhost:3000/api/market/search?q=002594'`

Expected: 只返回深圳主板候选，不包含原始异常或上游地址。

```powershell
git add src/types/stock-search.ts src/server/market-data/tencent-stock-search-service.ts src/server/market-data/tencent-stock-search-service.test.ts src/app/api/market/search/route.ts
git commit -m "feat: expose Shenzhen stock search API"
```

### Task 3: 全局搜索与观察池筛选分离

**Files:**
- Create: `src/components/search/stock-search-model.ts`
- Create: `src/components/search/stock-search-model.test.ts`
- Create: `src/components/search/stock-search-command.tsx`
- Modify: `src/components/layout/top-bar.tsx`
- Modify: `src/components/stocks/watchlist-view.tsx`

**Interfaces:**
- Consumes: `/api/market/search?q=<keyword>`。
- Produces: 全局候选链接 `/stocks/<code>?mode=research`。
- Produces: `shouldSearchStocks(query: string): boolean`。

- [ ] **Step 1: 写防抖触发阈值失败测试**

```ts
import { expect, it } from "vitest";
import { shouldSearchStocks } from "./stock-search-model";

it("requires a complete code or two non-space characters", () => {
  expect(shouldSearchStocks("002594")).toBe(true);
  expect(shouldSearchStocks("比亚")).toBe(true);
  expect(shouldSearchStocks("比")).toBe(false);
  expect(shouldSearchStocks("   ")).toBe(false);
});
```

- [ ] **Step 2: 实现模型与组件**

```ts
export function shouldSearchStocks(query: string): boolean {
  const normalized = query.trim();
  return /^\d{6}$/.test(normalized) || Array.from(normalized).length >= 2;
}
```

组件对合格输入执行 250ms 防抖请求，cleanup 中取消 `AbortController`。成功时渲染名称、代码、“深圳主板”及详情链接；失败时只显示“搜索暂不可用”；代码 `300750` 等不支持结果显示“仅支持深圳主板”。

在 `TopBar` 中加入组件，桌面宽度为 `min(420px, 100%)`，移动端独占一行。观察池现有输入框改为“筛选当前 20 只观察池”，仍只调用本地 `filterStocks`，不请求全局 API。

- [ ] **Step 3: 验证并提交**

Run: `npx vitest run src/components/search/stock-search-model.test.ts`

Expected: PASS。

Manual: 首页输入“比亚迪”显示 `002594`；观察池输入框仅筛选当前 20 只。

```powershell
git add src/components/search src/components/layout/top-bar.tsx src/components/stocks/watchlist-view.tsx
git commit -m "feat: add global Shenzhen stock search"
```

### Task 4: 外部股票研究详情与策略隔离

**Files:**
- Create: `src/server/market-data/research-stock-service.ts`
- Create: `src/server/market-data/research-stock-service.test.ts`
- Create: `src/components/stocks/research-stock-detail-view.tsx`
- Modify: `src/app/stocks/[code]/page.tsx`
- Modify: `src/app/stocks/[code]/not-found.tsx`

**Interfaces:**
- Consumes: `MarketDataService.getQuote(code)` 和 `MarketDataService.getDailyBars(code)`。
- Produces: `ResearchStockDetail`，只有 `quote`、`quoteMeta`、`dailyBars`、`dailyBarsMeta`、`isCoreWatchlist`。
- Guarantees: 外部结果不含 `StockAnalysis`、评分、信号、交易计划或策略输出。

- [ ] **Step 1: 写研究模式边界失败测试**

```ts
import { expect, it } from "vitest";
import { getResearchStockDetail } from "./research-stock-service";

it("returns a non-core stock as research-only data", async () => {
  const service = {
    getQuote: async () => ({ success: true as const, data: { code: "002594", name: "比亚迪", exchange: "SZSE" as const, price: 100, previousClose: 99, open: 99, high: 101, low: 98, change: 1, changePercent: 1.01, volume: 1, amount: 100, turnoverRate: 0, volumeRatio: 0, bidPrice: 100, askPrice: 100, marketTimestamp: "2026-07-22T15:00:00+08:00", receivedAt: "2026-07-22T15:00:00+08:00", status: "closed" as const, source: "tencent", isDemo: false }, meta: { source: "tencent", status: "closed" as const, marketTimestamp: "2026-07-22T15:00:00+08:00", receivedAt: "2026-07-22T15:00:00+08:00", isDemo: false } }),
    getDailyBars: async () => ({ success: true as const, data: [], meta: { source: "tencent", status: "unavailable" as const, marketTimestamp: null, receivedAt: "2026-07-22T15:00:00+08:00", isDemo: false } }),
  };
  const detail = await getResearchStockDetail("002594", service);
  expect(detail?.isCoreWatchlist).toBe(false);
  expect(detail?.quote.code).toBe("002594");
  expect("shortTermScore" in (detail ?? {})).toBe(false);
});
```

测试内服务只提供结构化实时数据，不得作为 live 页面 fallback。

- [ ] **Step 2: 实现研究服务和详情分流**

服务先调用 `assertAllowedStockCode(code)`，再并行取得报价和日线。报价失败返回 `null`；日线失败返回空数组及 `unavailable` 元数据。实现不得导入 `mockStocks`、`mockMarketHistory`、评分、策略或交易计划模块。

路由按下列规则处理：

```ts
if (watchlistCodes.includes(code)) {
  // 保留既有 getStockDetailFromMarketData 与 StockDetailView
} else {
  const research = await getResearchStockDetail(code);
  if (!research) notFound();
  return <ResearchStockDetailView detail={research} />;
}
```

路由新增 `export const dynamicParams = true`。研究视图显示“研究模式：不参与核心策略评分或交易计划”、真实报价状态、来源、更新时间和日线状态。仅当日线非空时使用现有 `StockPriceChart`；日线不可用时只显示“真实日线暂不可用”，不得显示 Mock 图。

404 文案更新为“代码不存在、非深圳主板，或当前无法取得真实研究数据”。

- [ ] **Step 3: 验证并提交**

Run: `npx vitest run src/server/market-data/research-stock-service.test.ts src/server/strategy-engine`

Expected: PASS，既有 `STOCK_NOT_IN_WATCHLIST` 行为保持不变。

Manual: `/stocks/002594?mode=research` 没有评分、buy、建仓区或保存交易计划；`/stocks/002472` 保留核心详情；`/stocks/300750` 明确不可用。

```powershell
git add src/server/market-data/research-stock-service.ts src/server/market-data/research-stock-service.test.ts src/components/stocks/research-stock-detail-view.tsx src/app/stocks/[code]/page.tsx src/app/stocks/[code]/not-found.tsx
git commit -m "feat: add research-only Shenzhen stock detail"
```

### Task 5: 回归验证与使用说明

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1 至 Task 4 的功能。
- Produces: 搜索范围、研究模式边界、腾讯来源的运行说明。

- [ ] **Step 1: 更新 README**

增加“深圳主板搜索”说明：全局搜索支持名称与六码代码，只限 `000`、`001`、`002`；结果是研究模式，不进入评分、策略、报告或交易计划；上游不可用时不以 Mock 冒充真实行情。

- [ ] **Step 2: 执行完整验证**

Run: `services/tencent-service/.venv/Scripts/python.exe services/tencent-service/tests/test_quote_parser.py`

Expected: PASS；该既有测试文件自行执行并调用 `sys.exit()`，不能由 pytest 整体收集。

Run: `services/tencent-service/.venv/Scripts/python.exe -m pytest services/tencent-service/tests/test_search_parser.py services/tencent-service/tests/test_timezone.py -q`

Expected: PASS。

Run: `npx tsc --noEmit`

Expected: exit code 0。

Run: `npm run lint`

Expected: exit code 0，记录既有 warnings，不新增 errors。

Run: `npm run test`

Expected: PASS。

Run: `npm run build -- --webpack`

Expected: 成功。

- [ ] **Step 3: 端到端验证与提交**

Run: `Invoke-RestMethod 'http://127.0.0.1:8001/search?query=%E6%AF%94%E4%BA%9A%E8%BF%AA'`

Run: `Invoke-RestMethod 'http://localhost:3000/api/market/search?q=%E6%AF%94%E4%BA%9A%E8%BF%AA'`

Expected: 两者仅返回深圳主板候选且包含 `002594`。

Manual: 在 `http://localhost:3000` 搜索“比亚迪”并打开 `/stocks/002594?mode=research`；随后打开 `/stocks/002472`，确认核心详情未变。

```powershell
git add README.md
git commit -m "docs: describe Shenzhen research search"
```
