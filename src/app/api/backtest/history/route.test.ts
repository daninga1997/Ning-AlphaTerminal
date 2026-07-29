import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/backtest/history", () => {
  it("returns a safe 400 response for an invalid request without calling upstream", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("http://localhost:3000/api/backtest/history?code=600000&start=2025-01-01&end=2025-12-31"));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      success: false,
      error: { code: "BACKTEST_INVALID_CODE", message: "仅支持深市主板股票代码" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a safe 502 response without raw upstream error details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => "internal secret" }));

    const response = await GET(new Request("http://localhost:3000/api/backtest/history?code=002472&start=2025-01-01&end=2025-12-31"));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toEqual({
      success: false,
      error: { code: "BACKTEST_HISTORY_UNAVAILABLE", message: "历史日线暂时不可用" },
    });
  });
});
