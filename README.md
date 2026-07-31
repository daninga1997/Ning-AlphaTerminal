# AStock Terminal

A 股深圳主板交易观察网页的静态演示项目。

## 当前阶段

Sprint 11 已完成：Alpha 龙头趋势共振策略引擎 V1；后续已接入腾讯行情、模拟盘与策略回测。

已完成：

- Next.js、TypeScript、TailwindCSS、ESLint、Prettier
- 暗色主题、中文系统字体、响应式 Layout
- 首页观察池摘要
- `/watchlist` 观察池页面
- 20 只深圳主板模拟观察股
- 桌面端表格布局
- 手机端卡片布局
- 按综合评分、短线评分、中线评分、涨跌幅、成交额排序
- 按板块筛选
- 按操作信号筛选
- 按股票名称或代码搜索
- A/B 级演示机会筛选纯函数
- 20 只股票独立详情页 `/stocks/[code]`
- 固定、可重复的 260 日模拟日线数据
- SMA、EMA、MACD、KDJ、RSI14、ATR14 等技术指标
- 可解释短线评分模型
- 可解释中线评分模型
- 建仓区、止损位、目标位和风险收益比算法
- Recharts 收盘价、MA5、MA10、MA20、成交量图表
- Vitest 单元测试
- `/memory` 交易记忆页面
- `/memory/[id]` 交易计划详情页
- Prisma + SQLite 本地交易计划数据库
- TradingPlan、PlanEvent、PlanReview、SignalSnapshot 数据模型
- 交易计划状态机、复盘计算、统计与导出 API
- DailyMarketBar、MinuteMarketBar、StockQuoteSnapshot、SectorDailySnapshot、MarketOverviewSnapshot、DataFetchRun
- 本地市场数据 Repository
- Quotes、Daily、Minutes、Sectors、Overview 同步 API
- 本地同步脚本和收盘固化流程
- Alpha 策略引擎 V1
- 龙头首阴修复、尾盘趋势确认、趋势波段三套固定策略
- 统一关注区、买入区、放弃追高价、动态止损、目标位和仓位模型
- `/api/strategies/stocks/[code]`
- `/api/strategies/watchlist`
- `/api/strategies/stocks/[code]/trade-plan`
- 腾讯行情实时报价接入（`services/tencent-service`）
- 全局股票搜索（`/api/market/search`）
- 模拟盘交易（`/paper-trades`）
- 策略回测（`/backtest`）

当前仍未接入：

- 券商级专业行情接口
- API 密钥
- AI 接口
- 真实建仓价格算法
- 券商交易能力
- AI Engine
- 自动参数优化

## 腾讯行情服务

Live 模式通过独立 Python FastAPI 服务（`services/tencent-service`）获取腾讯公开行情报价。

启动 Python 服务：

```powershell
python -m venv services/tencent-service/.venv
services\tencent-service\.venv\Scripts\python.exe -m pip install -r services/tencent-service/requirements.txt
npm run tencent:service
```

Next.js 切换到 Live：

```env
MARKET_DATA_MODE=live
TENCENT_SERVICE_BASE_URL=http://127.0.0.1:8001
```

腾讯行情是公开数据接口，稳定性和时效性不等同于交易所或券商专业行情。
实时报价之外的日线、分钟线、板块与市场概览数据来自本地数据仓库和同步流程。

## Alpha 策略引擎

策略引擎只使用已经通过 Data Integrity Layer 的输入，不直接请求行情 Provider。

当前策略：

- `leader_first_yin_v1`：龙头首阴修复。
- `late_session_momentum_v1`：尾盘趋势确认。
- `trend_swing_v1`：趋势波段。

当数据权限不是 `full` 时，系统不会生成新的 `buy_allowed`，也不会把高评分直接等同于可以买。

详细规则见 `docs/ALPHA-STRATEGY-ENGINE-V1.md`。

本地市场数据检查：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-market-data.ps1
```

## 模拟数据说明

当前股票基础信息、板块评分输入、静态价格快照和 260 日历史日线均为演示数据。

评分、建仓区、止损位、目标位和风险收益比由本地纯函数根据模拟历史行情计算，不再作为人工写死的最终结果。

演示模式支持任意 6 位 A 股代码（如 `000`/`001`/`002`/`003`/`300`/`600`/`601`/`603`/`688` 等）。
观察池之外的代码会自动生成确定性的演示行情画像；默认观察池仍为 20 只核心股票。

静态观察池以深圳主板标的为主，早期曾用 `002436 兴森科技` 替换 `603228 景旺电子`；
演示模式本身已不受板块或观察池限制。

## 目录结构

```text
src/
  app/
    page.tsx
    stocks/
      [code]/
        page.tsx
    watchlist/
      page.tsx
  components/
    dashboard/
      placeholder-dashboard.tsx
    layout/
      app-shell.tsx
      info-rail.tsx
      sidebar.tsx
      top-bar.tsx
    stocks/
      demo-data-notice.tsx
      score-badge.tsx
      score-breakdown-panel.tsx
      price-trend-chart.tsx
      stock-card.tsx
      stock-detail-view.tsx
      stock-filters.tsx
      stock-signal-badge.tsx
      stock-table.tsx
      watchlist-summary.tsx
      watchlist-view.tsx
  data/
    mock-market-history.ts
    mock-stocks.ts
  lib/
    indicators/
      index.ts
      indicators.test.ts
    scoring/
      short-term-score.ts
      mid-term-score.ts
    trading/
      trade-levels.ts
    stock-analysis.ts
    stock-ranking.ts
    stock-ranking.test.ts
  types/
    market.ts
    scoring.ts
    stock.ts
docs/
  stock-terminal-design.md
```

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

观察池页面：

```text
http://localhost:3000/watchlist
```

个股详情页示例：

```text
http://localhost:3000/stocks/002472
http://localhost:3000/stocks/002317
```

交易记忆页面：

```text
http://localhost:3000/memory
```

## Trading Memory

本地数据库使用 Prisma + SQLite。

环境变量：

```bash
DATABASE_URL="file:./data/alpha-terminal.db"
```

Prisma 命令：

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

当前已提供固定 seed 数据：

- 3 个短线计划
- 3 个波段计划
- 3 个中线计划
- Mock 与 Replay 分开标记
- 含不同状态和复盘结果

交易记忆 API：

- `/api/memory/plans`
- `/api/memory/plans/[id]`
- `/api/memory/plans/[id]/events`
- `/api/memory/plans/[id]/reviews`
- `/api/memory/stats`
- `/api/memory/export?format=json`
- `/api/memory/export?format=csv`

注意：当前在包含中文路径的 Windows 工作区里，Prisma 6 的 `migrate dev` schema-engine 可能无法直接写入 SQLite。本项目已保留迁移 SQL，并使用 Prisma Client 应用本地迁移与 seed。应用运行和 Prisma Client 查询正常。

## 策略回测 `/backtest`

- 访问 `/backtest` 可运行三种策略的历史回测：**突破买入**、**均线交叉**、**趋势跟踪**。
- 回测数据使用腾讯财经历史日线（每个请求最多 500 根 K 线），信号由确定性策略引擎生成。
- 交易执行模拟：信号次日开盘价入场、0.05% 滑点、0.03% 手续费（最低 5 元）、卖出 0.05% 费用、100 股整数倍。
- 回测报告仅存于内存（不写入数据库），包含权益曲线、完成交易明细、年化收益、最大回撤等指标。
- `/api/backtest/history?code=002472&days=250` 提供只读 GET 日的线端点，仅在使用有效的深圳主板代码和不超过 500 个交易日的情况下返回数据。
- 固定成本假设和目标价位在摘要区域中展示，不宣称盈利保证。
- 本地腾讯行情服务（`:8001` 端口）必须正在运行，否则日线请求将失败并显示错误提示。

## 测试和检查

```bash
npm run lint
npm run test
npm run build
```

TypeScript 类型检查：

```bash
npx tsc --noEmit
```

## A/B 级演示规则

当前 A/B 机会只是静态演示规则，不是自动荐股：

- A 级：综合评分不低于 90，`signal` 为 `buy`，风险不是 `high`
- B 级：综合评分不低于 85，`signal` 为 `buy` 或 `wait`，风险不是 `high`
- A 级最多 1 只
- B 级最多 2 只
- 不满足条件时不凑数

## 短线评分权重

- 板块强度：20 分，使用模拟板块评分输入
- 价格趋势：20 分，参考 MA5、MA10、MA20 和均线多头排列
- 成交量：20 分，参考当前成交量相对 20 日均量比例
- 动量指标：20 分，参考 MACD、KDJ、RSI14
- 风险收益比：20 分，参考第一目标收益与止损距离之比

## 中线评分权重

- 板块和产业逻辑：20 分，当前为演示评分输入
- 中期趋势：25 分，参考 MA20/MA60、近 60 日涨跌幅、MACD
- 周期位置：20 分，参考价格在近 20 日高低区间的位置
- 波动和回撤：15 分，参考最大回撤
- 筹码及量价结构代理指标：20 分，使用量比、20/60 日表现和 KDJ 作为代理

## 交易价位计算

- 第一建仓区：参考 MA10、MA20、平台支撑和 ATR
- 第二建仓区：参考 MA20、20 日低点和 ATR，必须低于第一建仓区
- 放弃追高价：参考当前价、ATR 和 20 日高点
- 止损位：参考最近 20 日有效低点和 ATR
- 目标位：参考前高、ATR 和风险收益比
- 当第一目标风险收益比低于 1.5 时，输出“当前盈亏比不足”

## 提醒

本项目仅用于个人交易观察工具的界面和规则演示。当前没有真实行情，也不构成投资建议。

## Paper Trading

The stock detail page supports research-only paper trades saved in local SQLite.

- Entry uses the server-side quote and does not send an order or contact a broker.
- The first strategy target and stop-loss settle the record at their configured prices.
- If neither condition occurs, the close of the fifth completed daily bar after entry settles the record.
- Only one open paper trade is allowed per stock; records persist after refresh and restart.
- Paper trades do not modify minute K-line retrieval, period controls, or auto-refresh.

API: `POST /api/paper-trades` and `GET /api/paper-trades?code=002472`.

The paper trade ledger is available at `/paper-trades`. It supports status filters, entry/exit/return sorting, and realized-result statistics. An open record can be manually closed only after a confirmation step; the server records its own live quote as the exit price. The client never submits an exit price.

On `/paper-trades`, open records refresh their displayed server quote and floating return every 30 seconds while the page is visible. Hidden pages do not poll. A list-row manual-close confirmation shows the latest displayed quote, while final settlement always re-reads the quote on the server and updates only that row plus the realized statistics.

## Stock Detail Feedback

`/stocks/[code]` provides a route loading skeleton while the detail data is rendered. Minute-period changes show a chart-area loading state; unavailable minute data stays inside the chart panel, and an empty successful response shows a no-data state instead of an empty chart. Simulated-trade reads keep their feedback inside the paper-trade panel. These states do not change minute-bar sources, Replay mode, or the existing auto-refresh rules.

## Market Data Layer V1

当前仍使用 Mock 行情，不支持自动交易。

运行模式通过环境变量控制：

```bash
MARKET_DATA_MODE=mock
```

允许值：

- `mock`：默认，使用固定、可重复的演示行情。
- `replay`：使用本地 CSV 分钟行情进行历史回放测试。
- `live`：预留模式，当前尚未配置正式行情 Provider。

API 地址：

- `/api/market/overview`
- `/api/market/sectors`
- `/api/market/quotes?codes=002472,002317`
- `/api/market/stocks/002472/quote`
- `/api/market/stocks/002472/bars?period=120d`
- `/api/market/health`
- `/api/market/provider`
- `/api/market/stocks/002472/minutes?period=1m&limit=120`

数据状态：

- `fresh`：交易时段内 15 秒以内。
- `delayed`：交易时段内超过 15 秒。
- `stale`：交易时段内超过 60 秒。
- `unavailable`：无可用数据。
- `market_closed`：非交易时段的收盘后数据。

当数据为 `stale` 或 `unavailable` 时，系统不会生成新的“可以买”信号，也不会把旧数据伪装成实时行情。

分钟级行情：

- 当前支持 `1m`、`5m`、`15m`、`30m`、`60m`。
- 分钟行情只用于确认趋势、量能、突破和跌破。
- 分钟行情不得单独生成买入结论。
- CSV 回放数据位于 `data/replay/`，仅用于开发测试。
