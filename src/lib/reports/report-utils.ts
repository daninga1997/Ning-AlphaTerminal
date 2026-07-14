import type { IntradayEventType, PlanResult, Report, ReportDataStatus, ReportType } from "@/types/report";

export function getSortedReports(reports: Report[]): Report[] {
  return [...reports].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export function getLatestReport(reports: Report[]): Report {
  const latest = getSortedReports(reports)[0];
  if (!latest) throw new Error("No reports available");
  return latest;
}

export function getReportsByType(reports: Report[], type: ReportType): Report[] {
  return getSortedReports(reports).filter((report) => report.type === type);
}

export function getOpportunityMessage(report: Report): string {
  return report.stocks.some((stock) => stock.level === "A") ? "存在A级机会" : "今日不开仓";
}

export function getDataStatusWarning(status: ReportDataStatus): string | null {
  if (status === "stale") return "数据已过期，请勿将旧报告当作当前结论。";
  if (status === "unavailable") return "数据不可用，仅保留报告结构，不生成交易判断。";
  if (status === "delayed") return "数据存在延迟，请结合生成时间判断有效性。";
  return null;
}

export function getEventTypeLabel(type: IntradayEventType): string {
  const labels: Record<IntradayEventType, string> = {
    breakout: "放量突破",
    breakdown: "跌破关键位",
    volume_spike: "量能异动",
    sector_rotation: "主线切换",
    risk_alert: "风险警报",
  };

  return labels[type];
}

export function getPlanResultLabel(result: PlanResult): string {
  const labels: Record<PlanResult, string> = {
    hit: "计划命中",
    pending: "继续观察",
    invalidated: "计划失效",
    avoided: "成功回避",
  };

  return labels[result];
}
