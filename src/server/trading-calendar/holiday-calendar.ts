/**
 * A股节假日列表
 *
 * 基于已知的A股休市安排，当前阶段使用手动配置。
 * 后续可通过 AKShare tool_trade_date_hist_sina 接口获取正式交易日历。
 *
 * 格式：YYYY-MM-DD
 */
const A_STOCK_HOLIDAYS_2026: ReadonlySet<string> = new Set([
  // 元旦
  "2026-01-01",
  "2026-01-02",
  // 春节
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-02-20",
  // 清明节
  "2026-04-06",
  // 劳动节
  "2026-05-01",
  "2026-05-04",
  "2026-05-05",
  // 端午节
  "2026-06-19",
  // 中秋节
  "2026-09-25",
  // 国庆节
  "2026-10-01",
  "2026-10-02",
  "2026-10-05",
  "2026-10-06",
  "2026-10-07",
  "2026-10-08",
]);

const A_STOCK_HOLIDAYS_2027: ReadonlySet<string> = new Set([
  "2027-01-01",
  // 春节 (预计)
  "2027-02-05",
  "2027-02-08",
  "2027-02-09",
  "2027-02-10",
  "2027-02-11",
  "2027-02-12",
]);

/** 所有已知节假日的合并集合 */
const ALL_HOLIDAYS: ReadonlySet<string> = new Set([
  ...A_STOCK_HOLIDAYS_2026,
  ...A_STOCK_HOLIDAYS_2027,
]);

/**
 * 判断指定日期是否为A股节假日（不含周末）
 */
export function isHoliday(dateStr: string): boolean {
  return ALL_HOLIDAYS.has(dateStr);
}

/**
 * 获取所有已配置的节假日列表（用于测试和显示）
 */
export function getConfiguredHolidays(): string[] {
  return Array.from(ALL_HOLIDAYS).sort();
}