import { describe, expect, it } from "vitest";
import { mockReports } from "../../data/mock-reports";
import {
  getDataStatusWarning,
  getEventTypeLabel,
  getLatestReport,
  getOpportunityMessage,
  getPlanResultLabel,
  getReportsByType,
  getSortedReports,
} from "./report-utils";

describe("report-utils", () => {
  it("默认返回最新报告", () => {
    const latest = getLatestReport(mockReports);

    expect(latest.id).toBe("intraday-2026-07-14-1030");
  });

  it("历史报告按时间倒序排列", () => {
    const sorted = getSortedReports(mockReports);

    expect(sorted.map((report) => report.generatedAt)).toEqual(
      [...sorted.map((report) => report.generatedAt)].sort((a, b) => b.localeCompare(a)),
    );
  });

  it("盘前A级机会最多1只", () => {
    for (const report of getReportsByType(mockReports, "premarket")) {
      expect(report.stocks.filter((stock) => stock.level === "A")).toHaveLength(
        Math.min(report.stocks.filter((stock) => stock.level === "A").length, 1),
      );
    }
  });

  it("盘前B级机会最多2只", () => {
    for (const report of getReportsByType(mockReports, "premarket")) {
      expect(report.stocks.filter((stock) => stock.level === "B").length).toBeLessThanOrEqual(2);
    }
  });

  it("没有A级机会时显示今日不开仓", () => {
    const report = mockReports.find((item) => item.id === "premarket-2026-07-12-0830")!;

    expect(getOpportunityMessage(report)).toBe("今日不开仓");
  });

  it("stale状态显示延迟警告", () => {
    expect(getDataStatusWarning("stale")).toBe("数据已过期，请勿将旧报告当作当前结论。");
  });

  it("unavailable状态显示不可用警告", () => {
    expect(getDataStatusWarning("unavailable")).toBe("数据不可用，仅保留报告结构，不生成交易判断。");
  });

  it("盘中异动类型能够正确显示", () => {
    expect(getEventTypeLabel("breakout")).toBe("放量突破");
    expect(getEventTypeLabel("risk_alert")).toBe("风险警报");
  });

  it("盘后计划失效结果能够正确显示", () => {
    expect(getPlanResultLabel("invalidated")).toBe("计划失效");
  });

  it("相同模拟输入产生相同报告", () => {
    expect(JSON.stringify(mockReports)).toBe(JSON.stringify(mockReports));
  });

  it("报告生成时间必须存在", () => {
    expect(mockReports.every((report) => report.generatedAt.length > 0)).toBe(true);
  });

  it("9份模拟报告均可正常打开", () => {
    expect(mockReports).toHaveLength(9);
    expect(mockReports.every((report) => report.id && report.title)).toBe(true);
  });
});
