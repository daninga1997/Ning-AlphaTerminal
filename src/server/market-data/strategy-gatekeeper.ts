/**
 * 策略引擎前置门卫
 *
 * 第一阶段：校验数据就绪
 *   - 日线 ≥60根 且 报价可用 → 放行
 *   - 以上任一不满足 → data_blocked
 *
 * 第二阶段：信号 → StrategyAction 映射
 */

import type { StrategyAction } from "../../types/strategy-action";
import type { StockSignal, TrendStage } from "../../types/stock";

/**
 * 默认日线最小根数
 * 当前分钟线不可用时，分钟线门卫跳过校验
 */
const MIN_DAILY_BARS = 60;

export type GatekeeperResult = {
  passed: boolean;
  blockers: string[];
  action: StrategyAction;
};

export function applyStrategyGatekeeper(
  barsCount: number,
  quoteAvailable: boolean,
  signal: StockSignal,
  trendStage: TrendStage,
  totalScore: number,
): GatekeeperResult {
  const blockers: string[] = [];

  if (!quoteAvailable) {
    blockers.push("QUOTE_MISSING");
  }
  if (barsCount < MIN_DAILY_BARS) {
    blockers.push(`DAILY_BARS_INSUFFICIENT (${barsCount}/${MIN_DAILY_BARS})`);
  }

  const passed = blockers.length === 0;

  if (passed) {
    return {
      passed: true,
      blockers: [],
      action: signalToStrategyAction(signal, trendStage, totalScore),
    };
  }

  return {
    passed: false,
    blockers,
    action: "data_blocked",
  };
}

function signalToStrategyAction(
  signal: StockSignal,
  trendStage: TrendStage,
  totalScore: number,
): StrategyAction {
  if (signal === "avoid") return "avoid";
  if (signal === "reduce") return "reduce";
  if (signal === "hold") return "hold";
  if (signal === "wait" && trendStage === "breakout") return "breakout_watch";
  if (signal === "wait") return "wait_for_pullback";
  if (totalScore >= 90) return "buy_allowed";
  return "focus";
}