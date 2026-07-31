import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getPaperTradeLoadData, PaperTradePanel } from "./paper-trade-panel";

describe("PaperTradePanel", () => {
  it("renders a local skeleton while simulated trades are loading", () => {
    const html = renderToStaticMarkup(<PaperTradePanel code="002472" />);

    expect(html).toContain("模拟交易");
    expect(html).toContain('data-testid="paper-trade-loading"');
  });

  it("only renders manual close for an open simulated trade", () => {
    const html = renderToStaticMarkup(
      <PaperTradePanel
        code="002472"
        initialData={{
          latestQuotePrice: 36,
          latestQuoteTimestamp: "2026-07-29T03:00:00.000Z",
          trades: [{
            id: "open-id",
            entryPrice: 35,
            entryTime: "2026-07-29T02:00:00.000Z",
            takeProfitPrice: 40,
            stopLossPrice: 32,
            status: "open",
            exitPrice: null,
            exitTime: null,
            returnPercent: null,
            settlementReason: null,
          }],
        }}
      />,
    );

    expect(html).toContain("手动平仓");
    expect(html).not.toContain("确认平仓");
  });

  it("treats unsuccessful paper-trade responses as unavailable data", () => {
    expect(getPaperTradeLoadData(false, { success: false })).toBeNull();
  });
});
