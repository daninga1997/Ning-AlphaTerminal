import type { TradeDecisionPermission, StrategyType, DataIntegrityReport, DataIntegrityIssueCode } from "../../types/data-integrity";

/**
 * 交易权限矩阵
 *
 * 根据数据完整性报告和策略类型，返回交易决策权限。
 *
 * 从 IntegrityReportBuilder 调用后，再传入 resolveTradeDecisionPermission，
 * 确保每个策略都有明确的权限判定。
 */

/**
 * 每种策略对其依赖数据字段的要求
 */
const STRATEGY_REQUIREMENTS: Record<
  StrategyType,
  {
    requiresLatestDaily: boolean;
    requiresMinuteBars: boolean;
    requiresPostMarketMinute: boolean; // 尾盘策略需要14:30后分钟数据
    requiresSector: boolean;
    requiresMarketOverview: boolean;
    minHistoryDays: number;
    description: string;
  }
> = {
  leader_first_yin: {
    requiresLatestDaily: true,
    requiresMinuteBars: false,
    requiresPostMarketMinute: false,
    requiresSector: true,
    requiresMarketOverview: true,
    minHistoryDays: 180, // 需要更多历史数据用于首板模式识别
    description: "龙头首阴策略",
  },
  late_session_momentum: {
    requiresLatestDaily: true,
    requiresMinuteBars: true,
    requiresPostMarketMinute: true,
    requiresSector: true,
    requiresMarketOverview: true,
    minHistoryDays: 60,
    description: "尾盘动量策略",
  },
  trend_swing: {
    requiresLatestDaily: true,
    requiresMinuteBars: false,
    requiresPostMarketMinute: false,
    requiresSector: true,
    requiresMarketOverview: true,
    minHistoryDays: 120,
    description: "趋势波段策略",
  },
  generic_short_term: {
    requiresLatestDaily: true,
    requiresMinuteBars: true,
    requiresPostMarketMinute: false,
    requiresSector: true,
    requiresMarketOverview: true,
    minHistoryDays: 60,
    description: "通用短线策略",
  },
  generic_mid_term: {
    requiresLatestDaily: true,
    requiresMinuteBars: false,
    requiresPostMarketMinute: false,
    requiresSector: true,
    requiresMarketOverview: true,
    minHistoryDays: 120,
    description: "通用中线策略",
  },
};

/**
 * 根据数据完整性报告和策略类型返回交易决策权限
 */
export function resolveTradeDecisionPermission(
  report: DataIntegrityReport,
  strategyType: StrategyType,
): TradeDecisionPermission {
  // 关键错误直接阻断
  const blockedCodes: DataIntegrityIssueCode[] = [
    "WRONG_TRADING_DATE",
    "FUTURE_TIMESTAMP",
    "MOCK_LIVE_MIXED",
    "REPLAY_LIVE_MIXED",
    "PROVIDER_UNAVAILABLE",
    "PRICE_INVALID",
    "DAILY_BARS_MISSING",
  ];

  const hasBlockingIssue = report.issues.some((i) =>
    blockedCodes.includes(i.code),
  );
  if (hasBlockingIssue) return "blocked";

  if (report.marketDataMode === "mock") return "historical_only";

  const req = STRATEGY_REQUIREMENTS[strategyType];

  // 检查各数据要求
  if (req.requiresLatestDaily && !report.dailyBarsLatestDate) {
    return "blocked";
  }

  if (req.requiresMinuteBars && !report.minuteBarsLatestDate) {
    return "watch_only";
  }

  if (req.requiresPostMarketMinute) {
    // 需要14:30后的分钟数据
    if (!report.minuteBarsLatestDate) return "watch_only";
    if (report.minuteBarsLatestDate) {
      const minuteTime = report.minuteBarsLatestDate.slice(11, 16);
      if (minuteTime < "14:30") return "watch_only";
    }
  }

  if (req.requiresSector && !report.quoteSource) {
    // 板块数据缺失降级
    if (report.completenessPercent < 60) return "watch_only";
  }

  // 权限判定
  if (report.completenessPercent >= 85) return "full";
  if (report.completenessPercent >= 60) return "watch_only";
  if (report.completenessPercent >= 40) return "historical_only";

  return "blocked";
}

/**
 * 判断是否可以生成指定操作
 */
export function canGenerateAction(
  permission: TradeDecisionPermission,
  action: "score" | "watch_zone" | "entry_price" | "buy_signal" | "trade_plan",
): boolean {
  if (permission === "blocked") return false;
  if (permission === "historical_only") return action === "score";
  if (permission === "watch_only") {
    return ["score", "watch_zone"].includes(action);
  }
  return true; // full
}