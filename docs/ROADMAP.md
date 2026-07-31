# Alpha Terminal Roadmap

## V0.1

- 建立 Next.js、TypeScript、TailwindCSS、暗色金融终端布局。
- 建立核心观察池和模拟数据。

## V0.5

- 完成 Dashboard、Watchlist、Stock Detail、Reports、Settings 的核心信息架构。
- 建立 Design System 和项目总规范。

## V0.7

- 建立 Market Data Layer、Data Integrity Layer、Trading Memory。
- 接入腾讯公开行情服务。
- 建立本地市场数据仓库。

## V1.0

- 完成 Alpha 策略引擎 V1。
- 三套固定策略：龙头首阴修复、尾盘趋势确认、趋势波段。
- 统一关注区、入场、止损、目标和仓位模型。

## V1.5

- 增加独立 Backtest 模块。
- 增加策略稳定性评估，但不做自动参数寻优。
- 完善盘前、盘中、盘后结构化报告。

## V2.0

- 引入 AI 解释层。
- 支持交易员个人规则配置。
- 支持多数据源健康监控和一致性校验。
- 保持不自动下单，所有交易动作必须由用户确认。
