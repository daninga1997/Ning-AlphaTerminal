# Minute Market Data V1

## 1. B方案定义

本阶段采用 B 方案：A股分钟级行情接入框架。目标是覆盖 20 只深圳主板观察股，用于趋势、量能、突破、跌破和交易计划监控。

本阶段不支持 Level-2、逐笔成交、秒级盘口、券商连接、自动下单。

## 2. 分钟级数据用途

分钟数据只用于确认：

- 最新价是否超过放弃追高价。
- 最新价是否跌破止损位。
- 最近5分钟是否有成交量。
- 是否存在明显数据断档。
- 是否处于连续交易时段。

分钟数据不得单独生成买入结论。

## 3. 不支持的 Level-2 能力

当前不支持：

- 十档盘口。
- 委托队列。
- 逐笔成交。
- 主力资金拆解。
- 秒级实时刷新。

## 4. Provider 适配流程

正式供应商接入时，需要新增 Provider 类并实现：

- `getQuote`
- `getQuotes`
- `getDailyBars`
- `getMinuteBars`
- `getSectorSnapshots`
- `getMarketOverview`
- `healthCheck`

不得在页面或组件中直接调用供应商。

## 5. CSV 回放使用方法

设置：

```bash
MARKET_DATA_MODE=replay
```

CSV目录：

```text
data/replay/
```

字段：

```text
timestamp,open,high,low,close,volume,amount
```

当前示例：

- `002472.csv`
- `002317.csv`
- `000661.csv`

回放数据为历史演示数据，页面和 API 必须标记 `isReplay` 和演示状态。

## 6. 环境变量

```bash
MARKET_DATA_MODE=mock
MARKET_DATA_LIVE_BASE_URL=
MARKET_DATA_LIVE_API_KEY=
MARKET_DATA_LIVE_PROVIDER_NAME=
MARKET_DATA_LIVE_TIMEOUT_MS=5000
MARKET_DATA_LIVE_MIN_INTERVAL_MS=60000
TENCENT_SERVICE_BASE_URL=http://127.0.0.1:8001
```

`MARKET_DATA_MODE=live` 时使用腾讯行情服务；Provider 由模式直接决定，不再读取
`MARKET_DATA_LIVE_PROVIDER`。

密钥只允许服务端读取，不得进入前端 Bundle、日志或 API 响应。

## 7. 缓存和刷新频率

交易时段：

- Quote缓存：15秒
- 1分钟K线缓存：30秒
- 5分钟及以上K线缓存：60秒

非交易时段：

- Quote缓存：5分钟
- 历史分钟K线缓存：30分钟

前端刷新默认 60 秒。页面不可见时暂停，重新可见时立即刷新一次。

## 8. 数据延迟规则

API 返回：

- `mode`
- `source`
- `marketTimestamp`
- `receivedAt`
- `status`
- `isDemo`
- `isReplay`
- `delayedSeconds`

回放模式显示历史回放，不显示实时行情。

## 9. 交易信号安全规则

新 buy 信号必须同时满足：

- 日线数据不是 `stale` 或 `unavailable`
- 分钟数据不是 `stale` 或 `unavailable`
- 数据来源清晰
- 更新时间符合阈值
- 风险收益比符合原规则
- 原评分模型允许 buy
- 分钟确认条件通过

分钟数据不可用时，显示“分钟行情不可用，等待确认”。

## 10. 接正式供应商需要提供的资料

- 正式授权证明。
- API 基础地址。
- 鉴权方式。
- Quote字段定义。
- 分钟K线字段定义。
- 频率限制。
- 延迟说明。
- 交易日历和时区规则。
- 错误码文档。

## 11. 腾讯行情分钟线说明

分钟线通过独立 Python 服务（`services/tencent-service`）获取腾讯公开行情。

限制：

- 只用于趋势、量能、突破和跌破确认。
- 不提高到高频轮询。
- 不提供 Level-2、盘口、逐笔成交。
- 如果上游接口不支持某周期或时间范围，必须返回明确能力错误。
