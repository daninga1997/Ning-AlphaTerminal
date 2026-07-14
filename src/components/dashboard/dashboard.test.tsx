import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { analyzeAllStocks } from "../../lib/stock-analysis";
import { Dashboard } from "./dashboard";

describe("Dashboard", () => {
  it("renders the core dashboard sections", () => {
    const html = renderToStaticMarkup(<Dashboard stocks={analyzeAllStocks()} />);

    expect(html).toContain("市场总览");
    expect(html).toContain("今日核心决策");
    expect(html).toContain("B 级机会");
    expect(html).toContain("主线板块");
    expect(html).toContain("观察池 Top10");
  });
});
