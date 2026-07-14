# AKShare Integration

## 1. 为什么采用独立Python服务

AKShare 是 Python 生态库。Alpha Terminal 的主应用是 Next.js，因此采用独立 FastAPI 服务隔离 Python 依赖，避免在 Next.js 请求中启动一次性 Python 进程。

## 2. 架构图

```text
浏览器
  -> Next.js页面/API
    -> MarketDataService
      -> AkShareLiveProvider
        -> Python FastAPI Service
          -> AKShare
```

浏览器不得直接调用 Python 服务。

## 3. 安装要求

- 64位 Python 3.9+
- FastAPI
- Uvicorn
- Pydantic
- AKShare
- pandas
- pytest/httpx 用于测试

当前已验证环境：Python 3.12.10，AKShare 1.16.98。

## 4. 启动步骤

```powershell
python -m venv services/akshare-service/.venv
services\akshare-service\.venv\Scripts\python.exe -m pip install -r services/akshare-service/requirements-dev.txt
powershell -ExecutionPolicy Bypass -File scripts/start-akshare-service.ps1
```

Next.js 使用：

```env
MARKET_DATA_MODE=live
MARKET_DATA_LIVE_PROVIDER=akshare
AKSHARE_SERVICE_BASE_URL=http://127.0.0.1:8001
AKSHARE_SERVICE_TIMEOUT_MS=12000
```

## 5. AKShare接口映射

| 能力 | AKShare接口 | 说明 |
| --- | --- | --- |
| 批量报价 | `stock_zh_a_spot_em` | 一次拉取全市场公开报价，再过滤观察池代码 |
| 日线 | `stock_zh_a_hist` | `period=daily`，支持 `none/qfq/hfq` |
| 分钟线 | `stock_zh_a_hist_min_em` | 支持 `1m/5m/15m/30m/60m`，能力取决于AKShare上游 |

## 6. 数据单位

- 价格：元/股
- 成交量：按 AKShare 原始字段映射为统一数值，不在前端伪造
- 成交额：元
- 涨跌幅、换手率、量比：按 AKShare 公开字段映射

缺失字段使用 `null`，不使用 `0` 伪装。

## 7. 缓存规则

- 报价缓存：默认 30 秒
- 日线缓存：默认 1800 秒
- 分钟线缓存：默认 60 秒
- 相同请求并发会合并
- 上游失败时如存在最后成功数据，返回 `stale`
- 异常数据不会写入缓存

## 8. 数据状态规则

AKShare公开数据默认不标记为交易所直连 `fresh`。Python服务会返回 `delayed/stale/unavailable/market_closed` 等状态，Next.js 继续经过既有安全规则处理。

`stale` 或 `unavailable` 会阻止新的 `buy` 信号。

## 9. 已知限制

- 不支持 Level-2。
- 不支持逐笔成交。
- 不支持券商交易。
- 不保证高频实时性。
- 板块快照和市场总览暂不由 AKShare Provider 提供。

## 10. 上游接口变化风险

AKShare上游字段可能变化。字段缺失时服务返回 `NORMALIZATION_ERROR`，不会把异常字段传到 Next.js。

## 11. 如何切回Mock/Replay

```env
MARKET_DATA_MODE=mock
```

或：

```env
MARKET_DATA_MODE=replay
```

不会自动从 AKShare 失败切回 Mock，以避免伪装真实行情。

## 12. 未来替换商业Provider

保留 `MarketDataProvider` 接口不变。未来商业 Provider 只需要新增 Provider 实现并在 registry 中选择，不需要修改页面。

## 13. 公开数据说明

公开数据接口，稳定性和时效性不等同于交易所或券商专业行情。Alpha Terminal 不将 AKShare 数据描述为 Level-2 或交易所直连行情。
