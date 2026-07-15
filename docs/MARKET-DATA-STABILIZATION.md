# Market Data Stabilization V1

## 1. 本地市场数据仓库

Sprint 10 新增 Prisma + SQLite 本地市场数据仓库，用于保存真实行情快照和同步日志。交易记忆表不变，市场数据通过独立 Repository 访问。

## 2. 数据模型

新增模型：

- `DailyMarketBar`：日线，唯一键为 `code + tradingDate + adjustment + source`。
- `MinuteMarketBar`：分钟线，唯一键为 `code + timestamp + period + source`。
- `StockQuoteSnapshot`：实时报价快照。
- `SectorDailySnapshot`：核心方向板块快照。
- `MarketOverviewSnapshot`：市场概览快照。
- `DataFetchRun`：同步运行记录。

所有写入前都校验 NaN / Infinity。日线和分钟线重复同步使用 upsert，不删除历史成功数据。

## 3. 日线同步机制

默认技术计算使用 `qfq`。`syncDailyBars` 先查询本地 `qfq` 覆盖数量；已有不少于 250 个交易日时不重复拉取完整历史。覆盖不足或强制检查时，才调用 AKShare `stock_zh_a_hist`。

上游失败时保留本地最近成功日线，返回 `stale`，不把旧日线标为最新。

## 4. 分钟线能力与限制

分钟线使用 AKShare `stock_zh_a_hist_min_em`。当前保留 1m、5m、15m、30m、60m Provider 接口。

限制：

- 不从日线推测分钟线。
- 不从 5 分钟反推 1 分钟。
- 午休 11:31-12:59 不生成伪 K 线。
- 09:30 前和 15:00 后不生成连续竞价 K 线。
- 上游失败时读取本地最后成功分钟线并标记 `stale`。

## 5. 板块数据来源和映射

内部 20 只观察股映射到五个核心方向：

- 创新药/医药
- 机器人
- AI硬件
- 军工
- 电力和能源设备

当前 AKShare 行业/概念板块东方财富函数在本环境不稳定。第一版保存的板块快照使用 AKShare 新浪公开报价对映射股票做核心方向代理评分，source 明确标记为 `AKShare stock_zh_a_spot sector proxy`，不得作为完整 A 级机会依据。

## 6. 市场环境评分

当前市场概览第一版使用观察池真实报价代理计算：

- 上涨家数占比
- 涨跌停比
- 成交额代理

由于尚未稳定接入全市场上涨家数、深证成指 MA20、沪深 300 MA20，结果标记为 `partial`。数据不完整时仓位上限固定为 `0%-20%`。

## 7. 收盘固化流程

`finalizeTradingDay` 执行顺序：

1. 检查 Asia/Shanghai 时间。
2. 15:05 前拒绝。
3. 周末拒绝。
4. 同步 Quotes。
5. 同步 Daily Bars。
6. 同步 Minute Bars。
7. 同步 Sectors。
8. 同步 Market Overview。
9. 记录 `DataFetchRun`。

流程幂等，失败步骤可重试，部分失败不删除成功数据。

## 8. 缓存和数据库职责

内存 cache 只负责短期请求复用。SQLite 负责跨重启持久化行情快照。Provider 不直接写数据库，`MarketSyncService` 组合 Provider 与 Repository。

## 9. 数据完整性接入

`partial` 已成为正式行情状态。数据不完整时：

- 不生成新的短线 buy。
- 不自动生成 active 交易计划。
- 交易计划 snapshot 可以记录 `partial`，但默认只能 draft。

## 10. 数据失败与降级规则

- 报价失败：保留最后成功报价并标记 stale；无缓存则 unavailable。
- 日线失败：读取本地真实日线并标记 stale；无本地数据则 unavailable。
- 分钟线失败：读取本地真实分钟线并标记 stale；无本地数据则 unavailable。
- 板块/市场概览不足：标记 partial，不冒充完整 Live 结论。

## 11. 本地同步脚本

- `scripts/sync-market-data.ps1`：同步 Quotes、Sectors、Market Overview。
- `scripts/sync-daily-close.ps1`：调用 finalize-day。
- `scripts/check-market-data.ps1`：检查 storage health 和 coverage。

POST 同步 API 需要本地 Host 和 `x-alpha-local-sync: true` Header。

## 12. 已知限制

- 当前东方财富报价接口不可用，报价使用新浪公开报价。
- AKShare 行业/概念板块 EM 函数在当前环境返回上游连接失败。
- 市场概览仍是观察池代理，不是全市场完整统计。
- 分钟线可用性取决于 `stock_zh_a_hist_min_em` 当前上游状态。

## 13. 未来商业数据 Provider 替换方式

保留 `MarketDataProvider` 与 `MarketDataRepository` 接口。未来商业 Provider 只需实现 Provider，并将同步服务指向新的 provider，不需要页面直接依赖供应商 SDK。
