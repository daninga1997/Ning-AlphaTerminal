import { describe, expect, it } from "vitest";
import { StockCard } from "./stock-card";
import { StockFiltersPanel } from "./stock-filters";

function isMemoComponent(component: unknown): boolean {
  return String((component as { $$typeof?: symbol }).$$typeof) === "Symbol(react.memo)";
}

describe("stock render optimization boundaries", () => {
  it("memoizes stock cards without a custom comparator", () => {
    expect(isMemoComponent(StockCard)).toBe(true);
    expect((StockCard as { compare?: unknown }).compare).toBeNull();
  });

  it("memoizes the filters panel without a custom comparator", () => {
    expect(isMemoComponent(StockFiltersPanel)).toBe(true);
    expect((StockFiltersPanel as { compare?: unknown }).compare).toBeNull();
  });
});
