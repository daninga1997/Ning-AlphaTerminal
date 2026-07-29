import { afterEach, describe, expect, it, vi } from "vitest";
import { TencentProvider } from "./tencent-provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TencentProvider health", () => {
  it("maps the quote service's last success time into ProviderHealth", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          status: "healthy",
          last_success_at: "2026-07-22T16:14:45+08:00",
          last_failure_at: null,
          daily_bars_last_success_at: "2026-07-22T16:14:40+08:00",
          daily_bars_last_failure_at: null,
        }),
      }),
    );

    const health = await new TencentProvider().healthCheck();

    expect(health.quoteLastSuccessAt).toBe("2026-07-22T16:14:45+08:00");
    expect(health.quoteLastFailureAt).toBeNull();
    expect(health.dailyBarsLastSuccessAt).toBe("2026-07-22T16:14:40+08:00");
    expect(health.dailyBarsLastFailureAt).toBeNull();
  });
});
