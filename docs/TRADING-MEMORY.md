# Trading Memory V1

## 目的

交易记忆用于保存“当时为什么关注一只股票”的完整上下文，包括原始信号、评分、建仓计划、风险提示、数据模式和后续复盘。它不是 AI 学习系统，不调用大模型，也不代表真实交易业绩。

## 数据模型

- `TradingPlan`：交易计划主体，保存股票、计划类型、状态、原始信号、最终信号、评分、建仓区、止损、目标位、风险收益比、理由、警告、数据模式和演示标识。
- `PlanEvent`：计划生命周期事件，例如创建、激活、触及建仓区、跌破止损、取消、失效、完成和手工备注。
- `PlanReview`：盘后复盘，记录结果、实际进出价格、收益率、最大有利/不利波动、持有天数、执行备注和经验总结。
- `SignalSnapshot`：计划创建时冻结的行情、指标、短线评分、中线评分和交易价格快照。

## 历史不可回写原则

1. 创建计划时必须同时创建 `SignalSnapshot`。
2. 后续评分变化不得覆盖原始快照。
3. `originalSignal` 不允许通过更新接口修改。
4. `finalSignal` 只能随计划状态变化而变化。
5. 状态变化必须写入 `PlanEvent`。
6. 用户手工补充必须以事件或复盘形式保存。
7. 删除计划默认使用归档字段，不物理删除审计记录。

## 状态机

允许转换：

- `draft -> active`
- `draft -> cancelled`
- `active -> triggered`
- `active -> cancelled`
- `active -> invalidated`
- `active -> expired`
- `triggered -> completed`
- `triggered -> invalidated`

终态：`completed`、`cancelled`、`invalidated`、`expired`。终态不能重新激活。

## SignalSnapshot 机制

`SignalSnapshot` 保存 JSON 字符串：

- `quoteJson`
- `indicatorsJson`
- `shortScoreJson`
- `midScoreJson`
- `tradeLevelsJson`

仓储层没有提供更新快照的方法；API 也不接受修改快照。详情页会把快照明确标记为“创建计划时知道的信息”。

## 复盘计算

服务端使用纯函数计算：

- `returnPercent = (exitPrice - entryPrice) / entryPrice * 100`
- `maxFavorableExcursionPercent = (highestPrice - entryPrice) / entryPrice * 100`
- `maxAdverseExcursionPercent = (lowestPrice - entryPrice) / entryPrice * 100`

空值或入场价为 0 时返回 0，避免 `NaN` 和 `Infinity`。

## 统计口径

`/memory` 和 `/api/memory/stats` 默认按 `mock` 模式统计，不混合 Mock、Replay、Live。

规则：

- `open` 或进行中计划不计入已完成统计。
- `not_triggered` 不计入盈亏胜率。
- 样本少于 20 条显示“小样本，仅供参考”。
- 胜率不等于模型未来成功概率。

## Mock / Replay / Live 隔离

- `mock`：固定演示数据。
- `replay`：历史回放数据。
- `live`：未来真实行情模式。

Mock 和 Replay 必须标记 `isDemo=true`。默认统计不把演示记录和真实记录混在一起。

## API

- `GET /api/memory/plans`
- `POST /api/memory/plans`
- `GET /api/memory/plans/[id]`
- `PATCH /api/memory/plans/[id]`
- `POST /api/memory/plans/[id]/events`
- `POST /api/memory/plans/[id]/reviews`
- `GET /api/memory/stats`
- `GET /api/memory/export?format=json`
- `GET /api/memory/export?format=csv`

API 使用统一 `{ success, data }` 或 `{ success, error }` 结构，不暴露数据库路径、环境变量和服务端堆栈。

## 数据导出

支持 JSON 和 CSV。CSV 使用 UTF-8 BOM，避免中文乱码。导出内容只读，不修改数据库。

## 隐私与风险

本地 SQLite 数据库保存交易计划和复盘信息，不应提交到 Git。演示计划不代表真实交易收益，不构成投资建议。

## 后续回测引擎如何读取

后续回测引擎只能读取 `TradingPlan`、`PlanEvent`、`PlanReview` 和冻结的 `SignalSnapshot`。回测结果不得反向覆盖历史计划，只能追加新的分析结果或事件记录。
