# Market Data Layer V1

Alpha Terminal 当前仍使用 Mock 行情。本层的目标是统一数据形态、Provider 接口、服务端缓存、API 响应和数据状态判断，为以后接入正式行情商做准备。

## 1. 数据流架构

```text
Page / API
  -> MarketDataService
    -> Provider Registry
      -> MockMarketDataProvider
      -> Future Live Provider
    -> MarketDataCache
    -> Freshness / Trading Session / Safety Guard
```

页面不得直接依赖具体 Provider。当前页面通过 server 端 MarketDataService 获取 Quote、K线、板块和市场概览。

Sprint 10 后新增持久化边界：

```text
Provider -> MarketSyncService -> MarketDataRepository -> Prisma/SQLite
MarketDataService -> Provider
MarketDataService -> Repository stale fallback
```

Provider 不直接操作数据库。页面不直接查询 Prisma。

新增本地存储模型：

- DailyMarketBar
- MinuteMarketBar
- StockQuoteSnapshot
- SectorDailySnapshot
- MarketOverviewSnapshot
- DataFetchRun

数据不完整时使用 `partial` 或 `stale`，不得标记为 `fresh`。

## 2. Provider 接口

`MarketDataProvider` 包含：

- `getQuote(code)`
- `getQuotes(codes)`
- `getDailyBars(code, options)`
- `getSectorSnapshots()`
- `getMarketOverview()`
- `healthCheck()`

所有 Provider 必须返回 `src/types/market-data.ts` 中定义的统一类型。

## 3. Mock 与 Live 模式

`MARKET_DATA_MODE=mock` 为默认模式。Sprint 6 后允许 `mock`、`replay`、`live`。

Mock 模式：

- 使用现有 20 只观察股和固定历史日线。
- `source = mock-provider`
- `isDemo = true`
- 数据固定、可重复，刷新不变化。

Live 模式：

- 设置为 `MARKET_DATA_MODE=live` 时，系统通过独立 Python FastAPI 服务（`services/tencent-service`）调用腾讯公开行情报价。
- 服务地址通过 `TENCENT_SERVICE_BASE_URL` 配置，默认 `http://127.0.0.1:8001`。
- 不允许自动退回 Mock 并伪装成真实行情。
- 腾讯行情属于公开数据接口，不等同于交易所直连或券商专业行情。

Replay 模式：

- 使用 `data/replay/` 下的本地 CSV 分钟行情。
- 明确标记为历史回放和演示数据。
- 不显示为实时行情。

## 4. 数据新鲜度规则

交易时段内：

- `fresh`：不超过 15 秒。
- `delayed`：15 秒至 60 秒。
- `stale`：超过 60 秒。
- `unavailable`：无数据。

非交易时段：

- 最近数据属于已结束交易时段时标记为 `market_closed`。
- 不显示为实时 `fresh`。

阈值集中在 `freshness.ts`。

## 5. 交易时段规则

时区固定为 Asia/Shanghai。

当前识别：

- 周末：`non_trading_day`
- 09:15 前：`premarket`
- 09:15-09:25：`auction`
- 09:30-11:30：`morning`
- 11:30-13:00：`lunch_break`
- 13:00-15:00：`afternoon`
- 15:00 后：`closed`

节假日列表独立封装在 `trading-calendar.ts`，后续可替换为正式交易日历。

## 6. 缓存策略

当前使用进程内缓存。

- 交易时段缓存时间较短。
- 非交易时段缓存时间较长。
- 相同 key 的并发请求会合并。
- 缓存过期后重新请求 Provider。
- Provider 异常时可返回最后一次成功数据，但必须标记 `stale`。
- 不允许静默使用无限期旧数据。
- 腾讯 Python 服务也有独立 TTL 缓存，Next.js 侧仍保留统一缓存和安全判断。

## 7. 错误处理

统一错误类型为 `MarketDataError`。

API 错误响应不暴露服务器堆栈：

```json
{
  "success": false,
  "error": {
    "code": "INVALID_STOCK_CODE",
    "message": "股票代码无效"
  }
}
```

## 8. API 接口

- `GET /api/market/overview`
- `GET /api/market/sectors`
- `GET /api/market/quotes?codes=002472,002317`
- `GET /api/market/stocks/[code]/quote`
- `GET /api/market/stocks/[code]/bars?period=120d`
- `GET /api/market/stocks/[code]/minutes?period=5m&limit=120`

腾讯 Python 服务内部接口：

- `GET http://127.0.0.1:8001/health`
- `GET http://127.0.0.1:8001/quotes?codes=002472,002317`
- `GET /api/market/health`
- `GET /api/market/provider`
- `GET /api/market/stocks/[code]/minutes?period=1m&limit=120`

统一成功响应：

```json
{
  "success": true,
  "data": {},
  "meta": {
    "source": "mock-provider",
    "status": "fresh",
    "marketTimestamp": "2026-07-14T10:30:00+08:00",
    "receivedAt": "2026-07-14T10:30:05+08:00",
    "isDemo": true
  }
}
```

## 9. 接入正式行情商步骤

1. 选择正式授权的数据供应商。
2. 新增 Live Provider，实现 `MarketDataProvider`。
3. 将密钥只放在 server 环境变量中。
4. 在 Provider Registry 中注册 live provider。
5. 验证新鲜度、缓存、错误、API 和页面状态显示。
6. 保持 Mock 与 Live 模式可明确区分。

## 10. 数据延迟和使用限制

当前数据为 Mock 演示行情，不代表真实行情。

当数据状态为 `stale` 或 `unavailable`：

- 不生成新的“可以买”信号。
- 不更新建仓区和目标位。
- 显示数据异常提示。
- 可以展示最后一次历史计算结果，但必须标注时间。
- 不得将历史结论描述为当前实时结论。
