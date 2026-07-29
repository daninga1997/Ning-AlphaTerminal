import type { BacktestReport } from "@/types/backtest";

export type BacktestViewState = "idle" | "loading" | "error" | "empty" | "report";

export function resolveBacktestViewState({
  hasStarted,
  isLoading,
  error,
  report,
}: {
  hasStarted: boolean;
  isLoading: boolean;
  error: string | null;
  report: BacktestReport | null;
}): BacktestViewState {
  if (!hasStarted) return "idle";
  if (isLoading) return "loading";
  if (error) return "error";
  if (!report || report.completedTradeCount === 0) return "empty";
  return "report";
}
