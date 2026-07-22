import { expect, it } from "vitest";
import { isUnsupportedStockCode, shouldSearchStocks } from "./stock-search-model";

it("requires a complete code or two non-space characters", () => {
  expect(shouldSearchStocks("002594")).toBe(true);
  expect(shouldSearchStocks("比亚")).toBe(true);
  expect(shouldSearchStocks("比")).toBe(false);
  expect(shouldSearchStocks("   ")).toBe(false);
});

it("rejects six-digit codes outside the Shenzhen mainboard scope", () => {
  expect(isUnsupportedStockCode("300750")).toBe(true);
  expect(isUnsupportedStockCode("600519")).toBe(true);
  expect(isUnsupportedStockCode("002594")).toBe(false);
  expect(isUnsupportedStockCode("比亚迪")).toBe(false);
});
