import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StockDetailError from "./error";

describe("StockDetailError", () => {
  it("renders a safe terminal error message and retry action", () => {
    const html = renderToStaticMarkup(<StockDetailError error={new Error("internal detail failure")} reset={() => {}} />);

    expect(html).toContain("详情页暂时无法加载");
    expect(html).toContain("重新加载");
    expect(html).not.toContain("internal detail failure");
  });
});
