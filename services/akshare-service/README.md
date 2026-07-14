# AKShare Service

Alpha Terminal 的本地 Python 行情服务。浏览器不会直接调用本服务，调用链固定为：

```text
Next.js MarketDataService -> AkShareProvider -> FastAPI -> AKShare
```

## 安装

```powershell
cd C:\Projects\AlphaTerminal
python -m venv services/akshare-service/.venv
services\akshare-service\.venv\Scripts\python.exe -m pip install -r services/akshare-service/requirements-dev.txt
```

## 启动

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-akshare-service.ps1
```

健康检查：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-akshare-service.ps1
```

## 接口

- `GET /health`
- `GET /quotes?codes=002472,002317`
- `GET /stocks/{code}/daily-bars?start=2026-01-01&end=2026-07-14&adjust=none`
- `GET /stocks/{code}/minute-bars?period=5m&limit=120`

## AKShare接口

- 报价：`stock_zh_a_spot_em`
- 日线：`stock_zh_a_hist`
- 分钟线：`stock_zh_a_hist_min_em`

所有 AKShare 调用集中在 `app/akshare_client.py`。

## 限制

- 仅允许 `000`、`001`、`002` 开头的 6 位深圳主板代码。
- 数据来自公开数据接口，稳定性和时效性不等同于交易所或券商专业行情。
- AKShare字段变化时返回 `NORMALIZATION_ERROR`。
- AKShare不可用时返回明确错误，不伪装为 Mock 实时行情。
