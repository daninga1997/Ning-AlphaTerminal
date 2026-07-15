import type { DataIntegrityReport, StrategyType, TradeDecisionPermission } from "../../types/data-integrity";
import { resolveTradeDecisionPermission, canGenerateAction } from "./permission-matrix";

export interface GuardedAction {
  allowed: boolean;
  permission: TradeDecisionPermission;
  reason: string | null;
}

/**
 * 交易计划生成闸门
 *
 * 所有评分、信号、买入区、止损、目标价生成前必须通过此Guard。
 */
export class TradePlanGuard {
  constructor(private readonly report: DataIntegrityReport) {}

  /**
   * 生成综合评分
   */
  canGenerateScore(strategyType?: StrategyType): GuardedAction {
    const permission = strategyType
      ? resolveTradeDecisionPermission(this.report, strategyType)
      : this.report.permission;

    const allowed = canGenerateAction(permission, "score");
    return {
      allowed,
      permission,
      reason: allowed ? null : this.buildDenyReason("综合评分", permission),
    };
  }

  /**
   * 生成关注区（Watch Zone）
   */
  canGenerateWatchZone(strategyType?: StrategyType): GuardedAction {
    const permission = strategyType
      ? resolveTradeDecisionPermission(this.report, strategyType)
      : this.report.permission;

    const allowed = canGenerateAction(permission, "watch_zone");
    return {
      allowed,
      permission,
      reason: allowed ? null : this.buildDenyReason("关注区", permission),
    };
  }

  /**
   * 生成精确买入价
   */
  canGenerateEntryPrice(strategyType?: StrategyType): GuardedAction {
    const permission = strategyType
      ? resolveTradeDecisionPermission(this.report, strategyType)
      : this.report.permission;

    const allowed = canGenerateAction(permission, "entry_price");
    return {
      allowed,
      permission,
      reason: allowed ? null : this.buildDenyReason("精确买入价", permission),
    };
  }

  /**
   * 生成 buy 信号
   */
  canGenerateBuySignal(strategyType: StrategyType): GuardedAction {
    const permission = resolveTradeDecisionPermission(this.report, strategyType);

    const allowed = canGenerateAction(permission, "buy_signal");
    return {
      allowed,
      permission,
      reason: allowed
        ? null
        : `数据完整性不足（${permission}），禁止生成买入信号。完整度: ${this.report.completenessPercent}%`,
    };
  }

  /**
   * 保存交易计划
   */
  canSaveTradePlan(strategyType: StrategyType): GuardedAction {
    const permission = resolveTradeDecisionPermission(this.report, strategyType);

    if (permission === "blocked") {
      return {
        allowed: false,
        permission,
        reason: "数据完整性被阻断，禁止保存交易计划",
      };
    }

    if (permission === "historical_only") {
      return { allowed: false, permission, reason: "仅支持历史分析，不能保存交易计划" };
    }

    if (permission === "watch_only") {
      return { allowed: true, permission, reason: "仅允许保存draft状态" };
    }

    if (!this.report.canGenerateTradePlan) {
      return {
        allowed: false,
        permission,
        reason: `数据不满足完整交易计划条件。完整度: ${this.report.completenessPercent}%`,
      };
    }

    return { allowed: true, permission, reason: null };
  }

  private buildDenyReason(action: string, permission: TradeDecisionPermission): string {
    const issues = this.report.issues.map((i) => i.message).join("；");
    return `${action}被阻止。权限: ${permission}，完整度: ${this.report.completenessPercent}%。${issues ? ` 问题: ${issues}` : ""}`;
  }
}