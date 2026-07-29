/**
 * 信号有效期计算
 *
 * 基础规则：
 *   breakout_watch → T+2
 *   buy_allowed → T+3
 *   focus → T+5
 *   wait_for_pullback → T+8
 *
 * 波动率修正（带保底回退）：
 *   高波（HV前30%分位）→ 基础有效期 -1
 *   低波（HV后30%分位）→ 基础有效期 +1
 *   保底：最短≥T+1
 *   回退：HV不可用时直接使用基础有效期
 */

import type { StrategyAction } from "../../types/strategy-action";

const BASE_VALIDITY: Record<string, number> = {
  breakout_watch: 2,
  buy_allowed: 3,
  focus: 5,
  wait_for_pullback: 8,
};

const MIN_VALIDITY = 1;

/**
 * 计算信号有效截止日
 * @param action 策略动作
 * @param fromDate 分析日（T日）
 * @param hvPercentile HV分位值，null表示不可用
 */
export function computeSignalValidUntil(
  action: StrategyAction,
  fromDate: Date,
  hvPercentile: number | null,
): string {
  const baseDays = BASE_VALIDITY[action];
  if (baseDays == null) {
    // 对于 avoid/data_blocked/hold/reduce，不计算有效期
    return new Date(fromDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  }

  let adjustedDays = baseDays;

  // 波动率修正
  if (hvPercentile !== null && hvPercentile >= 0 && hvPercentile <= 1) {
    if (hvPercentile >= 0.70) {
      adjustedDays -= 1;
    } else if (hvPercentile <= 0.30) {
      adjustedDays += 1;
    }
  }

  adjustedDays = Math.max(MIN_VALIDITY, adjustedDays);

  // 计算截止日期（跳过非交易日）
  let target = new Date(fromDate);
  let daysAdded = 0;
  while (daysAdded < adjustedDays) {
    target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
    const day = target.getDay();
    if (day !== 0 && day !== 6) {
      daysAdded++;
    }
  }

  return target.toISOString().split("T")[0];
}