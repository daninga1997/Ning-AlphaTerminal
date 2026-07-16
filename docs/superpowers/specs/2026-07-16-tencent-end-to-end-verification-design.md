# 腾讯报价端到端验证设计

## 目标

在不改动 Dashboard、Watchlist、Stock Detail、评分或策略逻辑的前提下，验证 Alpha Terminal 的真实腾讯报价链路：

`腾讯公开报价 -> FastAPI :8001 -> Next.js /api/market/quotes -> /test-tencent`

测试成功的标准是页面明确显示返回的非演示报价、数据来源、状态和时间戳；测试失败时明确显示失败层级和安全错误码，不回退为 Mock 数据。

## 范围

- 启动并验证 `services/tencent-service` 的 `/health` 与 `/quotes`。
- 将本地开发环境的行情模式切换为 `live`，使既有 Provider Registry 选择 `TencentProvider`。
- 新增 `/test-tencent` 验收页，仅调用同源 `/api/market/quotes`，避免浏览器跨域和重复数据逻辑。
- 新增针对测试页数据状态的最小测试。

不包含：主页面接入、Watchlist 迁移、数据源重构、AKShare 文档清理、评分变更和策略变更。

## 实现边界

1. `/test-tencent` 作为 Client Component，首次加载请求两只观察池股票的同源 API。
2. 页面仅展示：请求状态、`source`、`mode`、`status`、`receivedAt`、`marketTimestamp`、每只股票的代码/名称/价格/涨跌幅，以及原始 JSON。
3. `success: false`、HTTP 非 2xx、空报价和 `isDemo: true` 均以失败状态展示；不将任何失败替换为模拟数据。
4. 使用现有 `/api/market/quotes`、`MarketDataService` 和 `TencentProvider`；不新建第二套 API 或前端直连腾讯上游。
5. 仅以本地 `.env` 配置启用 `MARKET_DATA_MODE=live`，不提交 `.env`。

## 错误处理

- FastAPI 未启动：Next API 返回统一行情错误，测试页显示“Next 到腾讯服务不可用”。
- 上游无数据：保持错误码，不显示伪造价格。
- 数据为 Mock 或来源不是 `tencent`：测试页标记验证不通过。
- 成功报价：要求 `isDemo === false`、价格为有限正数、来源为 `tencent`。

## 验收步骤

1. 运行 Python 服务并检查 `GET /health`。
2. 访问 `GET /quotes?codes=002472,002317`，确认两只股票均返回真实非空价格。
3. 访问 `GET /api/market/quotes?codes=002472,002317`，确认经 Next.js 转发后的响应仍为成功。
4. 打开 `/test-tencent`，确认页面显示两只股票、非演示标记和腾讯来源。
5. 运行 TypeScript、lint、测试和生产构建。

## 成功后的下一步

本验证页通过后，单独规划将 Watchlist 的报价展示迁移到已验证数据链，绝不在本次直接修改主页面。
