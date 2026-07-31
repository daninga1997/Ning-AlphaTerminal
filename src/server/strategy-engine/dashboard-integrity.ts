import type { DataIntegrityReport } from "../../types/data-integrity";

type StrategyInputWithIntegrity = {
  integrityReport: DataIntegrityReport;
};

export async function loadDashboardIntegrityReport(
  code: string,
  loadInput: (code: string) => Promise<StrategyInputWithIntegrity>,
): Promise<DataIntegrityReport | null> {
  try {
    return (await loadInput(code)).integrityReport;
  } catch {
    return null;
  }
}
