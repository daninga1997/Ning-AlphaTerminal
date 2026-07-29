export type StrategyAction =
  | "buy_allowed"        // 满足买入条件 → 加入观察池
  | "wait_for_pullback"  // 等待回踩 → 加入观察池
  | "breakout_watch"     // 突破观察 → 加入观察池
  | "focus"              // 重点关注 → 加入观察池
  | "avoid"              // 回避 → 不加入
  | "data_blocked"       // 数据阻断 → 不加入
  | "hold"               // 持股中 → 不加入
  | "reduce";            // 减仓 → 不加入

export const AUTO_JOIN_ACTIONS: ReadonlySet<StrategyAction> = new Set([
  "buy_allowed",
  "wait_for_pullback",
  "breakout_watch",
  "focus",
]);

export const DATA_BLOCKED_ACTION: StrategyAction = "data_blocked";