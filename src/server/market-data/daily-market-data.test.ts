import { afterEach, describe, expect, it, vi } from "vitest";
import { TencentProvider } from "./providers/tencent/tencent-provider";

afterEach(() => vi.unstubAllGlobals());

describe("Tencent daily bars", () => {
  it("请求260根日线以满足趋势策略250根完整历史的要求", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [{ time: "2026-07-29", open: 10, high: 11, low: 9, close: 10.5, volume: 1000 }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await new TencentProvider().getDailyBars("002472");

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("count=260");
  });
});
