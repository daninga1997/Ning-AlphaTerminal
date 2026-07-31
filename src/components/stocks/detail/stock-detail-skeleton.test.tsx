import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StockDetailSkeleton } from "./stock-detail-skeleton";

describe("StockDetailSkeleton", () => {
  it("renders terminal-shaped placeholders for the key detail areas", () => {
    const html = renderToStaticMarkup(<StockDetailSkeleton />);

    expect(html).toContain('data-testid="stock-detail-loading"');
    expect(html).toContain("交易计划");
    expect(html).toContain("模拟交易");
    expect(html).toContain("价格走势");
  });
});
