import { describe, expect, it, vi } from "vitest";
import type { DataIntegrityReport } from "../../types/data-integrity";
import { loadDashboardIntegrityReport } from "./dashboard-integrity";

const report = {
  code: "002472",
  completenessPercent: 100,
  permission: "full",
  canGenerateTradePlan: true,
} as DataIntegrityReport;

describe("loadDashboardIntegrityReport", () => {
  it("uses the strategy input integrity report instead of inventing an empty one", async () => {
    const loadInput = vi.fn().mockResolvedValue({ integrityReport: report });

    await expect(loadDashboardIntegrityReport("002472", loadInput)).resolves.toBe(report);
    expect(loadInput).toHaveBeenCalledWith("002472");
  });

  it("returns null when the strategy input cannot be loaded", async () => {
    await expect(
      loadDashboardIntegrityReport("002472", async () => {
        throw new Error("storage unavailable");
      }),
    ).resolves.toBeNull();
  });
});
