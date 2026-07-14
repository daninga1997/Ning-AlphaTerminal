import { describe, expect, it } from "vitest";
import { mockStocks } from "../data/mock-stocks";
import { analyzeAllStocks, analyzeStock } from "./stock-analysis";

describe("stock-analysis", () => {
  it("20只股票都能生成有效详情页数据", () => {
    const analyses = analyzeAllStocks();

    expect(analyses).toHaveLength(20);
    for (const stock of mockStocks) {
      expect(analyzeStock(stock.code)).not.toBeNull();
    }
  });

  it("非观察池代码返回 null", () => {
    expect(analyzeStock("999999")).toBeNull();
  });

  it("所有计算结果可重复，刷新后不变化", () => {
    const first = JSON.stringify(analyzeStock("002472"));
    const second = JSON.stringify(analyzeStock("002472"));

    expect(first).toBe(second);
  });
});
