import type { PlanEventType, PlanType, ReviewOutcome, TradingPlanStatus } from "@/server/trading-memory/trading-plan-repository";

export const planTypeLabels: Record<PlanType, string> = {
  short_term: "短线",
  swing: "波段",
  mid_term: "中线",
};

export const statusLabels: Record<TradingPlanStatus, string> = {
  draft: "草稿",
  active: "进行中",
  triggered: "已触发",
  cancelled: "已取消",
  invalidated: "已失效",
  completed: "已完成",
  expired: "已过期",
};

export const eventLabels: Record<PlanEventType, string> = {
  created: "创建计划",
  activated: "激活计划",
  entry_zone_touched: "触及建仓区",
  chase_limit_exceeded: "超过追高线",
  stop_loss_broken: "跌破止损",
  first_target_reached: "达到第一目标",
  second_target_reached: "达到第二目标",
  signal_changed: "信号变化",
  data_became_stale: "数据延迟",
  data_unavailable: "数据不可用",
  cancelled: "取消计划",
  invalidated: "计划失效",
  completed: "完成计划",
  manual_note: "手工备注",
};

export const outcomeLabels: Record<ReviewOutcome, string> = {
  not_triggered: "未触发",
  cancelled: "已取消",
  stopped_out: "止损",
  first_target: "第一目标",
  second_target: "第二目标",
  manual_exit: "手动退出",
  expired: "过期",
  open: "仍在观察",
};

export function formatPrice(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(2) : "-";
}
