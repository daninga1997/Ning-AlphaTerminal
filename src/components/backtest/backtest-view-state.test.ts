import { describe, expect, it } from "vitest";
import type { BacktestReport } from "@/types/backtest";
import { resolveBacktestViewState } from "./backtest-view-state";

const noTradeReport = { completedTradeCount: 0 } as BacktestReport;
const completedReport = { completedTradeCount: 1 } as BacktestReport;

describe("resolveBacktestViewState", () => {
  it("is idle before a user starts a run", () => {
    expect(
      resolveBacktestViewState({ hasStarted: false, isLoading: false, error: null, report: null }),
    ).toBe("idle");
  });

  it("prioritizes loading while retaining any prior report", () => {
    expect(
      resolveBacktestViewState({
        hasStarted: true,
        isLoading: true,
        error: null,
        report: completedReport,
      }),
    ).toBe("loading");
  });

  it("shows an error only after a failed request", () => {
    expect(
      resolveBacktestViewState({
        hasStarted: true,
        isLoading: false,
        error: "历史日线暂时不可用",
        report: null,
      }),
    ).toBe("error");
  });

  it("identifies a completed report with no closed trades", () => {
    expect(
      resolveBacktestViewState({
        hasStarted: true,
        isLoading: false,
        error: null,
        report: noTradeReport,
      }),
    ).toBe("empty");
  });

  it("identifies a completed report with trades", () => {
    expect(
      resolveBacktestViewState({
        hasStarted: true,
        isLoading: false,
        error: null,
        report: completedReport,
      }),
    ).toBe("report");
  });
});
