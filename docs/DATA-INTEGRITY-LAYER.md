# Data Integrity Layer V1

## 1. 为什么交易策略必须先验证数据

交易决策的质量完全依赖于输入数据的质量。数据不完整、过期、来源不一致或日期错误都会导致：
- 错误的买入信号
- 基于旧数据的精确买入价
- Mock数据的组合被用于正式决策

因此，任何市场评分、个股评分、交易信号、关注价、买入价、止损价和目标价在生成前都必须先通过统一的数据完整性校验。

固定原则：**先验证事实，再运行策略，最后生成交易计划。**

## 2. 最新交易日判断规则

- 时区固定使用 Asia/Shanghai
- 不使用用户电脑本地日期直接判断交易日
- 使用周末规则 + 独立可配置的A股节假日列表
- **交易日 15:10 以前**：最新完整日线日期为上一交易日
- **交易日 15:10 以后**：最新完整日线日期为当日
- **非交易日**：返回最近一个交易日
- 不允许未来日期

## 3. 盘前、盘中、盘后时间锁

| 阶段 | 时间 | 规则 |
|------|------|------|
| 盘前 | 09:15前 | Quote可以不可用，最新日线为上一交易日 |
| 盘中 | 09:25-15:00 | Quote必须属于当前交易日，日线用于历史参考 + 实时分钟线 |
| 收盘后 | 15:10后 | 日线最新日期必须为当前交易日才能生成完整次日计划 |
| 非交易日 | 周末/节假日 | 可读取最近交易日数据，页面标记实际交易日期 |

## 4. 数据完整度计算

权重分配：
- Quote：15分
- Daily Bars：25分
- Minute Bars：20分
- Sector：15分
- Market Overview：15分
- Source一致性：10分

关键错误（返回0分）：WRONG_TRADING_DATE, FUTURE_TIMESTAMP, MOCK_LIVE_MIXED, SOURCE_CONFLICT, QUOTE_MISSING, DAILY_BARS_MISSING, PROVIDER_UNAVAILABLE, PRICE_INVALID

阈值：
- ≥85：可以生成完整交易计划
- 60-84：仅允许观察
- 40-59：历史分析
- <40 或关键错误：完全阻断

## 5. 数据来源一致性

- Mock和Live不得混合生成正式交易计划
- Replay和Live不得混合
- 不同Live Provider允许组合但须明确记录
- 来源冲突时禁止精确买入价和新buy

## 6. 策略权限矩阵

| 策略 | 最新日线 | 分钟线 | 板块 | 市场总览 |
|------|---------|--------|------|---------|
| trend_swing | ✓ | - | ✓ | ✓ |
| generic_mid_term | ✓ | - | ✓ | ✓ |
| generic_short_term | ✓ | ✓ | ✓ | ✓ |
| leader_first_yin | ✓ | - | ✓ | ✓ |
| late_session_momentum | ✓ | ✓(14:30后) | ✓ | ✓ |

## 7. TradePlanGuard

所有以下功能必须经过Guard：综合评分、策略命中、关注区、买入区、止损价、目标价、buy信号、active计划保存

规则：
- `full`：允许完整交易计划
- `watch_only`：允许关注理由/条件触发/观察状态，不允许精确买入价和新buy
- `historical_only`：只允许历史分析
- `blocked`：只显示数据问题

## 8. Mock、Replay、Live隔离

- Mock模式下所有数据标记isDemo=true
- Mock+Live混合触发MOCK_LIVE_MIXED错误
- Replay+Live混合触发REPLAY_LIVE_MIXED错误
- 页面可同时展示，但必须分别标识且不共同计算

## 9. 页面展示规范

- Dashboard：显示交易日、行情截止时间、完整度、权限、来源
- Watchlist：每只股票显示简短状态（完整/仅观察/历史数据/数据阻断）
- Stock Detail：数据事实卡片（代码、交易日、Quote时间、日线最新日期、分钟线最新时间、来源、完整度、权限）
- Reports：数据截止时间、完整度、是否为完整报告
- Settings：完整性规则说明和当前市场完整性状态

## 10. 审计日志

- JSONL格式，按日期分文件存储在 `data/integrity-logs/`
- 记录：validatedAt, code, analysisTradingDate, status, permission, completenessPercent, issueCodes, sources
- 不记录完整行情、密钥、用户隐私
- 写入失败不影响行情页面
- 日志不得提交Git
- 保留30天
- Settings显示最近完整性校验摘要

## 11. 已知限制

- 节假日列表当前为手动配置，后续可通过公开交易日历接口获取正式交易日历
- 板块数据当前使用行情公开报价对观察池核心方向做代理评分，标记为partial，不得作为完整A级机会依据
- 分钟线数据优先来自本地数据仓库与同步流程，失败时只读取本地真实stale数据，不使用日线推测分钟线
- 实时行情使用腾讯公开报价接口（qt.gtimg.cn）

## 12. 后续正式交易日历接入方案

1. 使用公开交易日历接口获取历史交易日历
2. 将节假日列表从手动配置迁移为动态加载
3. 支持每年自动更新节假日数据
