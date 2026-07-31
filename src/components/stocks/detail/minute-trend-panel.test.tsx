import { describe, expect, it } from "vitest";
import { getMinuteTrendViewState } from "./minute-trend-panel";

describe("getMinuteTrendViewState", () => {
  it("prioritizes the loading state before data is available", () => {
    expect(getMinuteTrendViewState({ isLoading: true, response: null })).toBe("loading");
  });

  it("distinguishes unavailable data from an empty successful response", () => {
    expect(getMinuteTrendViewState({ isLoading: false, response: { success: false } })).toBe("error");
    expect(getMinuteTrendViewState({ isLoading: false, response: { success: true, data: [] } })).toBe("empty");
  });

  it("renders a chart only when successful minute bars exist", () => {
    expect(getMinuteTrendViewState({
      isLoading: false,
      response: {
        success: true,
        data: [{
          code: "002472",
          timestamp: "2026-07-29T10:00:00+08:00",
          open: 10,
          high: 10.2,
          low: 9.8,
          close: 10.1,
          volume: 100,
          amount: 1010,
          averagePrice: 10.1,
          previousClose: 10,
          source: "tencent",
          receivedAt: "2026-07-29T10:00:01+08:00",
          status: "fresh",
          isDemo: false,
        }],
      },
    })).toBe("chart");
  });
});
