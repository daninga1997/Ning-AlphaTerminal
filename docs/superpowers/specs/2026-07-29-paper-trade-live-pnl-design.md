# 模拟交易列表实时浮盈与手动平仓设计

## 目标

让 `/paper-trades` 中仍在进行的模拟交易显示服务器获取的最新报价和浮动盈亏，并能在不刷新整个页面的前提下完成二次确认后的模拟手动平仓。

## 范围与约束

- 仅修改模拟交易列表及其既有 API/服务边界。
- `/paper-trades` 页面可见时每 30 秒刷新；页面隐藏时不发起轮询。
- 不修改个股详情页的轮询、分钟 K 线或其自动刷新。
- 不创建 `/api/paper-trades/close`。沿用 `POST /api/paper-trades/[id]/close`，以交易记录 ID 标识待结算记录。
- 最新报价只能来自服务端市场快照。客户端不提交、也不决定成交价。
- 已结算记录不带实时价、浮盈或平仓操作。

## 数据流

1. `listAllAndSettle` 读取进行中记录，逐条加载市场快照。
2. 每条可用报价映射为 `liveQuotesByTradeId[trade.id]`；获取异常或报价无效时填 `null`，且不影响其余记录和页面响应。
3. 服务端仍可按已有规则自动结算到止盈、止损或到期状态。
4. 列表界面将进行中记录的 `entryPrice` 与实时价计算 `(current - entry) / entry * 100`，并显示正负百分比；无报价显示 `--`。
5. 手动平仓确认框展示列表最近一次报价，同时说明服务端将在确认时重新取价。成功响应返回已平仓记录及全量统计数据，客户端仅替换该行和统计状态，不执行页面刷新。

## 接口契约

`GET /api/paper-trades?status=...&sort=...` 成功响应的 `data` 新增：

```ts
type LivePaperTradeQuote = {
  price: number;
  marketTimestamp: string;
  source: string;
};

type PaperTradesData = {
  trades: PaperTradeSummary[];
  statistics: PaperTradeStatisticsData;
  liveQuotesByTradeId: Record<string, LivePaperTradeQuote | null>;
};
```

只为 `status === "open"` 的记录填充键值；其他记录不会暴露实时行情字段。

`POST /api/paper-trades/[id]/close` 成功响应改为：

```ts
type PaperTradeCloseData = {
  trade: PaperTradeSummary;
  statistics: PaperTradeStatisticsData;
};
```

若服务器报价不可用，继续返回既有的 `PAPER_TRADE_QUOTE_UNAVAILABLE`，记录保持进行中。

## 交互

- 行情刷新不会出现全屏加载态或清空既有记录。
- 进行中记录显示“当前价”“浮动盈亏”和“手动平仓”。
- 第一次点击“手动平仓”只展开所在行的确认区并展示当前价；无当前价时禁用确认按钮。
- 确认成功后，该行即时切换为“手动平仓”，显示实际服务器成交价和收益率；统计面板同步更新。
- 已结算记录只保留原始买入、卖出、收益与状态展示。
