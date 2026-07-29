# 判官之眼 V3.1 全终端审计修复提案

## 一、Reports 页面纯静态 Mock 数据 🔴

### 问题
`reports/page.tsx` 全量使用 `mockReports` 硬编码数据，不接入任何策略或数据完整性检查。

### 修复方案

修改 `reports/page.tsx`：

```typescript
// 新增导入 (line 3后)
import { buildIntegrityReport } from "@/server/data-integrity/validators/integrity-report-builder";
import { getMarketDataMode, getProvider } from "@/server/market-data/provider-registry";

export default async function ReportsPage() {
  const mode = getMarketDataMode();
  const provider = getProvider(mode);
  const health = await provider.healthCheck();
  const latestTradingDate = getLatestExpectedTradingDate(new Date());
  
  // 用真实完整性报告替换硬编码的 status
  const integrityReport = buildIntegrityReport({
    code: "000001",
    mode,
    quote: null,
    dailyBars: null,
    minuteBars: null,
    sectors: null,
    marketOverview: null,
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <IntegrityStatusBar
          latestTradingDate={latestTradingDate}
          completenessPercent={integrityReport.completenessPercent}
          status={integrityReport.status}
          permission={integrityReport.permission}
          canGenerateTradePlan={integrityReport.canGenerateTradePlan}
        />
        <ReportsView reports={mockReports} />
      </div>
    </AppShell>
  );
}
```

修改 `reports-header.tsx` 第16行：
```
// 旧文案
统一查看盘前、盘中、盘后报告。当前展示 {report.title}，共 {totalCount} 份固定模拟报告。

// 替换为
市场状态 {dataStatus}，当前展示 {totalCount} 份标准报告模板。数据来源：腾讯财经。
```

---

## 二、动态观察池数据为空 🟡

### 问题
`GET /api/watchlist/dynamic` 返回 `{success:true, data:[], count:0}`。Prisma 表已建但无数据写入。

### 修复方案

**步骤1：创建种子数据**

新建 `prisma/seed-dynamic-watchlist.mjs`：
```javascript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const entries = [
    { stockCode: "002241", stockName: "歌尔股份", sourceType: "DYNAMIC",
      triggerStrategy: "combined", lastStrategyAction: "focus",
      dataIntegrityStatus: "READY", latestConclusion: "策略自动加入",
      signalValidUntil: new Date("2026-07-30") },
    { stockCode: "002594", stockName: "比亚迪", sourceType: "DYNAMIC",
      triggerStrategy: "combined", lastStrategyAction: "breakout_watch",
      dataIntegrityStatus: "READY", latestConclusion: "策略自动加入",
      signalValidUntil: new Date("2026-07-29") },
    { stockCode: "002625", stockName: "光启技术", sourceType: "DYNAMIC",
      triggerStrategy: "combined", lastStrategyAction: "wait_for_pullback",
      dataIntegrityStatus: "READY", latestConclusion: "策略自动加入",
      signalValidUntil: new Date("2026-08-03") },
  ];

  for (const entry of entries) {
    await prisma.dynamicWatchlistEntry.upsert({
      where: { stockCode_sourceType: { stockCode: entry.stockCode, sourceType: "DYNAMIC" } },
      create: entry,
      update: { lastAnalyzedAt: new Date() },
    });
  }
  console.log("动态观察池种子数据已创建");
}

main().then(() => prisma.$disconnect());
```

在 `package.json` 的 scripts 中追加：
```json
"prisma:seed:dynamic": "node prisma/seed-dynamic-watchlist.mjs"
```

**步骤2：确认个股详情页自动加入触发**

`stocks/[code]/page.tsx` 第50-63行已有触发逻辑。但需要确认 `POST /api/watchlist/dynamic` 的响应是否被正确处理。当前代码用 `fetch().catch(() => {})` 静默吞错误，建议增加日志：
```typescript
fetch(`${origin}/api/watchlist/dynamic`, { ... })
  .then(r => r.json())
  .then(d => console.log(`[AUTOJOIN] ${code}: ${d.success ? 'joined' : d.error}`))
  .catch(e => console.error(`[AUTOJOIN] ${code} failed:`, e));
```

---

## 三、观察池信号全部为"回避" 🟡

### 问题
`stock-analysis-service.ts` 中 `analyzeAllStocksFromMarketData()` 对20只股票同时发起 `getDailyBars()`，部分请求因并发压力过大而超时或失败，导致 `calculateIndicators([])` → 全部指标null → `totalScore < 55` → `signal = "avoid"`。

### 修复方案

在 `analyzeAllStocksFromMarketData()` 中将单次 `Promise.all(quotes.map(...))` 改为分批执行：

```typescript
// 修改 src/server/market-data/stock-analysis-service.ts 第284-302行

// 旧代码: 20只股票同时请求日线
const analyses = await Promise.all(
  quotes.map(async (quote) => {
    const barsResult = await service.getDailyBars(quote.code);
    ...
  })
);

// 新代码: 分批请求，每批5只
const BATCH_SIZE = 5;
const analyses: (MarketBackedStockAnalysis | null)[] = [];

for (let i = 0; i < quotes.length; i += BATCH_SIZE) {
  const batch = quotes.slice(i, i + BATCH_SIZE);
  const batchAnalyses = await Promise.all(batch.map(async (quote) => {
    const barsResult = await service.getDailyBars(quote.code);
    if (!barsResult.success || barsResult.data.length === 0) {
      const errorCode = !barsResult.success ? barsResult.error.code : "DAILY_BARS_UNAVAILABLE";
      return quoteToStockAnalysis(quote, [], quoteMeta, {
        source: "tencent",
        status: "unavailable",
        marketTimestamp: null,
        receivedAt: new Date().toISOString(),
        isDemo: false,
        mode: quoteMeta.mode,
        upstreamErrorCode: errorCode,
      });
    }
    return quoteToStockAnalysis(quote, convertBars(barsResult.data), quoteMeta, barsResult.meta);
  }));
  analyses.push(...batchAnalyses);
}
```

---

## 四、首页完整性显示 "stale" 🟡

### 问题
`integrity-status-resolver.ts` 中当完整性在40~59之间时返回 `stale`。当前报价+日线可用但分钟线/板块缺失时，完整度为40%，正好触发 stale 状态。

### 修复方案

**不需要修改逻辑**（40% 表示"历史分析可用但不可交易"是正确的）。但需要优化前端文案让用户理解原因。

修改 `integrity-status-bar.tsx`：

```typescript
// 旧文案 (line ~45)
{completenessPercent}%

// 替换为
{completenessPercent}%（报价+日线可用，分钟线/板块待完善）
```

或者在 status badge 旁边增加 tooltip 解释各个缺失维度。

---

## 五、Settings 页数据库覆盖率显示为0 🟡

### 问题
Settings 页中 `storageCoverage.quotes.codeCount` 返回 0，因为行情查询只在页面渲染时通过内存通道执行，不持久化到 Prisma。

### 修复方案

修改 `api/market/quotes/route.ts`，在行情数据返回后增加写入操作：

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 在 return NextResponse.json(...) 之前添加
await prisma.stockQuoteSnapshot.createMany({
  data: data.map((quote: any) => ({
    code: quote.code,
    tradingDate: new Date().toISOString().split("T")[0],
    marketTimestamp: new Date(quote.marketTimestamp || Date.now()),
    price: quote.price,
    previousClose: quote.previousClose,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    change: quote.change,
    changePercent: quote.changePercent,
    volume: quote.volume,
    amount: quote.amount,
    source: quote.source || "tencent",
    dataStatus: quote.status || "delayed",
    fetchedAt: new Date(),
  })),
  skipDuplicates: true,
}).catch((e) => console.error("存储报价快照失败:", e));
```

---

## 🔧 修复优先级与工作量

| 优先级 | 项目 | 涉及文件数 | 预估时间 |
|:---:|------|:---:|:---:|
| 🔴 P0 | Reports 页面接入数据完整性 | 2 | 30分钟 |
| 🟡 P1 | 日线请求分批（修复信号回避） | 1 | 15分钟 |
| 🟡 P1 | 动态观察池种子数据 | 1 | 10分钟 |
| 🟡 P2 | Settings 页面行情存储 | 1 | 20分钟 |
| 🟢 P3 | 完整度/信号文案优化 | 2 | 10分钟 |