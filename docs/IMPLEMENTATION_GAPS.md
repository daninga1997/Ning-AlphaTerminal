# 实现差距审计

## ✅ 已完成

| 模块 | 文件 | 状态 |
|------|------|------|
| StrategyAction 类型定义 | `src/types/strategy-action.ts` | ✅ |
| 两阶段门卫 | `src/server/market-data/strategy-gatekeeper.ts` | ✅ |
| 动态观察池存储 | `src/server/watchlist-storage/dynamic-watchlist-repository.ts` | ✅ |
| 信号有效期计算 | `src/server/watchlist-storage/signal-validity.ts` | ✅ |
| API端点 | `src/app/api/watchlist/dynamic/route.ts` | ✅ |
| Watchlist合并排序 | `src/lib/watchlist-merge.ts` | ✅ |
| 路由前置拦截 | `src/app/stocks/[code]/page.tsx:27-41` | ✅ |
| 写入重试 | `src/app/api/watchlist/dynamic/route.ts:55-70` | ✅ |

## ❌ 未完成（6项）

### 1. 个股详情页未实际调用策略门卫
**位置**: `src/app/stocks/[code]/page.tsx` 和 `src/server/market-data/research-stock-service.ts`
**问题**: 门卫 `applyStrategyGatekeeper` 已经实现但没有被任何页面/服务调用。外部股票进入 `ResearchStockDetailView` 后不会触发门卫→策略动作→自动加入逻辑。

### 2. Watchlist页面未接入合并数据
**位置**: `src/app/watchlist/page.tsx`
**问题**: 仍使用旧的 `WatchlistView` 组件，未调用 `GET /api/watchlist/dynamic` 获取动态条目，未使用 `mergeWatchlist()` 合并展示。

### 3. WatchlistView UI未更新展示字段
**位置**: `src/components/stocks/watchlist-view.tsx`
**问题**: 计划要求"策略动作徽章"和"数据状态徽章"分离展示，"阻断时覆盖隐藏动作徽章"，"过期条目置灰沉底"。当前UI只有旧版信号展示。

### 4. 板块缺失占位未实现
**位置**: V2.1 二.2 — "评分依据"区域保留指标名，数值展示灰色 `--`
**问题**: `score-breakdown-panel.tsx` 未实现此占位逻辑。

### 5. 搜索解耦未实现
**位置**: V2.1 五.1 — 前端搜索框实时下拉联想仅拉取基础行情
**问题**: 现有搜索逻辑未确认是否已解耦。

### 6. 验收测试未写入
**位置**: V2.1 六 — 11条验收用例
**问题**: 一条测试都未创建。现有 `257 passing` 是存量测试，与新增功能无关。

## ⚠️ 局部完成但缺少布线（2项）

### 7. 内存存储缺乏持久化
**位置**: `src/server/watchlist-storage/dynamic-watchlist-repository.ts`
**问题**: 使用 `Map<string, T>` 内存存储，服务重启数据丢失。计划原定 V2.1 使用 Prisma UPSERT。

### 8. 自动加入触发点缺失
**问题**: `stock-analysis-service.ts` 的 `getStockDetailFromMarketData()` 和 `getResearchStockDetail()` 都不调用门卫和 `POST /api/watchlist/dynamic`。策略分析完成后没有触发自动加入逻辑。