# AStock Terminal

A 股深圳主板交易观察网页的静态演示项目。

## 当前阶段

Sprint 7 已完成：Trading Memory V1 交易计划与复盘记忆系统。

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
- 固定、可重复的 120 日模拟日线数据
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

当前仍未接入：

- 券商级专业行情接口
- API 密钥
- AI 接口
- 自动荐股
- 真实建仓价格算法
- 券商交易能力

## AKShare公开行情服务

Sprint 8 增加独立 Python FastAPI 服务，用于通过 AKShare 获取 A 股公开数据。

启动 Python 服务：

```powershell
python -m venv services/akshare-service/.venv
services\akshare-service\.venv\Scripts\python.exe -m pip install -r services/akshare-service/requirements-dev.txt
powershell -ExecutionPolicy Bypass -File scripts/start-akshare-service.ps1
```

Next.js 切换到 AKShare：

```env
MARKET_DATA_MODE=live
MARKET_DATA_LIVE_PROVIDER=akshare
AKSHARE_SERVICE_BASE_URL=http://127.0.0.1:8001
```

AKShare 是公开数据接口，稳定性和时效性不等同于交易所或券商专业行情。

## 模拟数据说明

当前股票基础信息、板块评分输入、静态价格快照和 120 日历史日线均为演示数据。

评分、建仓区、止损位、目标位和风险收益比由本地纯函数根据模拟历史行情计算，不再作为人工写死的最终结果。

观察池范围限制：

- 只允许 6 位股票代码
- 只允许 `000`、`001`、`002` 开头
- 用于模拟深圳主板观察池

`603228 景旺电子` 不符合上述代码范围，已在静态观察池中替换为 `002436 兴森科技`。

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
