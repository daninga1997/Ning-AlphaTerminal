import { describe, expect, it } from "vitest";
import { HISTORY_LENGTH, getMockMarketHistory, mockMarketHistory } from "./mock-market-history";
import { getMockStockForCode, mockStocks } from "./mock-stocks";

describe("mock-market-history", () => {
  it("20 只股票都拥有 260 根日线且基础金融逻辑正确", () => {
    expect(Object.keys(mockMarketHistory)).toHaveLength(20);

    for (const stock of mockStocks) {
      const bars = mockMarketHistory[stock.code] ?? [];
      expect(bars).toHaveLength(HISTORY_LENGTH);
      for (const bar of bars) {
        expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close, bar.low));
        expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close, bar.high));
        expect(bar.volume).toBeGreaterThanOrEqual(0);
        expect(bar.turnover).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("模拟历史行情可重复生成且刷新后不变化", () => {
    const first = JSON.stringify(mockMarketHistory["002472"]);
    const second = JSON.stringify(mockMarketHistory["002472"]);

    expect(first).toBe(second);
  });

  it("观察池之外的任意6位代码也能生成确定性的模拟历史", () => {
    const bars = getMockMarketHistory("600519");
    expect(bars).toHaveLength(HISTORY_LENGTH);
    expect(JSON.stringify(getMockMarketHistory("600519"))).toBe(JSON.stringify(bars));

    const profile = getMockStockForCode("600519");
    expect(profile.code).toBe("600519");
    expect(profile.sectorScore).toBeGreaterThanOrEqual(55);
  });
});
