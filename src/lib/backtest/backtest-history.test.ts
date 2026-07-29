import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBacktestHistory } from "./backtest-history";

function upstreamResponse(rows: Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }>) {
  return {
    ok: true,
    json: async () => ({
      success: true,
      source: "tencent",
      updated_at: "2025-12-31T15:00:00+08:00",
      data: rows,
    }),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchBacktestHistory", () => {
  it("uses GET with count=500 and returns only the requested closed date range", async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstreamResponse([
      { time: "2024-12-31", open: 10, high: 11, low: 9, close: 10, volume: 1_000 },
      { time: "2025-01-02", open: 11, high: 12, low: 10, close: 11, volume: 1_100 },
      { time: "2025-12-31", open: 12, high: 13, low: 11, close: 12, volume: 1_200 },
      { time: "2026-01-02", open: 13, high: 14, low: 12, close: 13, volume: 1_300 },
    ]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBacktestHistory({ code: "002472", start: "2025-01-01", end: "2025-12-31" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("symbol=002472&period=day&count=500"),
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
    expect(result.bars.map((bar) => bar.date)).toEqual(["2025-01-02", "2025-12-31"]);
    expect(result.returnedTradingDays).toBe(2);
    expect(result.bars.every((bar) => !bar.isDemo && bar.source === "tencent")).toBe(true);
  });

  it("rejects a caller range that exceeds 500 returned trading days instead of truncating it", async () => {
    const rows = Array.from({ length: 501 }, (_, index) => ({
      time: new Date(Date.UTC(2023, 0, index + 1)).toISOString().slice(0, 10),
      open: 10,
      high: 11,
      low: 9,
      close: 10,
      volume: 1_000,
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamResponse(rows)));

    await expect(fetchBacktestHistory({ code: "002472", start: "2023-01-01", end: "2025-12-31" }))
      .rejects.toMatchObject({ code: "BACKTEST_RANGE_TOO_LARGE", statusCode: 400 });
  });

  it("rejects malformed Shenzhen codes before making a network request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchBacktestHistory({ code: "600000", start: "2025-01-01", end: "2025-12-31" }))
      .rejects.toMatchObject({ code: "BACKTEST_INVALID_CODE", statusCode: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not expose an upstream response body when daily data is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => "secret upstream detail" }));

    await expect(fetchBacktestHistory({ code: "002472", start: "2025-01-01", end: "2025-12-31" }))
      .rejects.toMatchObject({ code: "BACKTEST_HISTORY_UNAVAILABLE", message: "历史日线暂时不可用", statusCode: 502 });
  });
});
