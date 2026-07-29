# 动态观察池优化方案

## 问题1：策略引擎未就绪

当前信号系统是 `buy | wait | hold | reduce | avoid` 五值，需要升级为 `StrategyAction` 枚举以区分"可加入观察池"和"不可加入观察池"的场景。

### 方案：定义 StrategyAction 枚举

```typescript
// 新增文件: src/types/strategy-action.ts
export type StrategyAction =
  | "buy_allowed"        // 满足买入条件 → 加入
  | "wait_for_pullback"  // 等待回踩 → 加入
  | "breakout_watch"     // 突破观察 → 加入
  | "focus"              // 重点关注 → 加入
  | "avoid"              // 回避 → 不加入
  | "data_blocked"       // 数据阻断 → 不加入
  | "hold"               // 持股中 → 不加入
  | "reduce"             // 减仓 → 不加入
```

### 映射逻辑

在 `stock-analysis-service.ts` 中新增转换函数：
```typescript
function signalToStrategyAction(signal: StockSignal, trendStage: TrendStage, totalScore: number, isDataBlocked: boolean): StrategyAction {
  if (isDataBlocked) return "data_blocked";
  if (signal === "avoid") return "avoid";
  if (signal === "reduce") return "reduce";
  if (signal === "hold") return "hold";
  if (signal === "wait" && trendStage === "breakout") return "breakout_watch";
  if (signal === "wait") return "wait_for_pullback";
  if (totalScore >= 90) return "buy_allowed";
  return "focus";
}
```

---

## 问题2：数据能力缺口导致大量 `data_blocked`

当前真实数据覆盖：报价✅ 日线✅ 分钟线❌ 板块❌ 市场概览❌

### 方案：分级接受策略

| 缺失维度 | 动作 | 原因 |
|----------|------|------|
| 报价缺失 | `data_blocked` | 无报价无法计算任何指标 |
| 日线缺失 | `data_blocked` | 无日线无法计算技术指标和评分 |
| 仅分钟线缺失 | 允许加入，标记"分钟线不可用" | 日线分析为主，分钟线可缺失 |
| 仅板块上下文缺失 | 允许加入，标记"板块信息缺失" | 板块评分可置零，不影响核心策略 |
| 市场概览缺失 | 允许加入 | 市场概览非个股必需 |

### 实现方式

在 `analyzeStockFromMarketData()` 返回的 `MarketBackedStockAnalysis` 上新增字段：
```typescript
dataBlockers: string[]  // 阻断原因列表，空数组表示无阻断
```

`data_blocked` 仅当 `dataBlockers` 包含 `"QUOTE_MISSING"` 或 `"DAILY_BARS_MISSING"` 时才触发。

---

## 问题3：存储依赖不明确

当前有两套存储：Prisma 数据库和 mock 数据文件。

### 方案：新增独立 API 端点

不建议混合到 Prisma 或 mock 数据中，而是新建一个轻量的动态观察池存储：

```
GET    /api/watchlist/dynamic           → 获取全部动态条目
POST   /api/watchlist/dynamic           → 写入/更新动态条目
DELETE /api/watchlist/dynamic?code=xxx  → 移除动态条目
```

存储格式（JSON 文件或 SQLite 单表）：
```typescript
type DynamicWatchlistEntry = {
  code: string
  name: string
  source: "strategy_auto_join"         // 固定值
  firstAddedAt: string                  // ISO 时间
  lastAnalyzedAt: string
  triggeredStrategy: "short_term" | "mid_term" | "combined"
  lastAction: StrategyAction
  dataStatus: string
  lastConclusion: string
  lastAnalysisDate: string
}
```

存储文件路径：`data/dynamic-watchlist.json`（无需 Prisma 迁移，读写简单）

---

## 问题4：现有代码冲突

| 冲突点 | 优化方案 |
|--------|---------|
| `stock-ranking.ts` 的 `getOpportunities()` 只处理 mockStocks | 新增 `mergeWatchlistItems()` 函数，合并核心池 + 动态池 |
| `dashboard.tsx` 的 `QuickWatchlist` 固定显示 top10 | 扩展为接受 `WatchlistItem[]`（含来源标签） |
| `watchlist/page.tsx` 的 `WatchlistView` 只接受 `StockAnalysis[]` | 扩展 Props 接受 `{ core: StockAnalysis[], dynamic: DynamicWatchlistEntry[] }` |

### Watchlist 合并伪代码

```typescript
function mergeWatchlist(core: StockAnalysis[], dynamic: DynamicEntry[]): WatchlistItem[] {
  const coreCodes = new Set(core.map(s => s.code));
  const items: WatchlistItem[] = core.map(s => ({
    ...s,
    source: "核心观察池" as const,
  }));
  for (const entry of dynamic) {
    if (coreCodes.has(entry.code)) continue;  // 不重复
    items.push({
      code: entry.code,
      name: entry.name,
      source: "策略自动加入" as const,
      lastAction: entry.lastAction,
      lastAnalyzedAt: entry.lastAnalyzedAt,
      dataStatus: entry.dataStatus,
    });
  }
  return items;
}
```

---

## 实现顺序建议

| 步骤 | 内容 | 预估工作量 |
|------|------|-----------|
| 1 | 定义 `StrategyAction` 类型 + 映射函数 | 小 |
| 2 | 实现 `dataBlockers` 分级逻辑 | 小 |
| 3 | 新建 `/api/watchlist/dynamic` 端点 | 中 |
| 4 | 个股详情页调用策略引擎 + 自动加入逻辑 | 中 |
| 5 | Watchlist 合并展示 + 来源标签 | 中 |
| 6 | 测试覆盖（重复分析幂等、avoid/data_blocked 不加入等） | 中 |