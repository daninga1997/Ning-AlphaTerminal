import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaperTradesView, type PaperTradesData } from "./paper-trades-view";

const data: PaperTradesData = {
  trades: [{
    id: "paper-1",
    code: "002472",
    name: "双环传动",
    sector: "机器人",
    entryPrice: 35.75,
    entryTime: "2026-07-29T03:00:00.000Z",
    takeProfitPrice: 40,
    stopLossPrice: 32,
    status: "manual_closed",
    exitPrice: 36,
    exitTime: "2026-07-29T04:00:00.000Z",
    returnPercent: 0.7,
  }],
  statistics: {
    totalCount: 1,
    settledCount: 1,
    winRate: 100,
    totalReturnPercent: 0.7,
    averageReturnPercent: 0.7,
  },
  liveQuotesByTradeId: {},
};

describe("PaperTradesView", () => {
  it("renders a linked trade record, filters, and realized statistics", () => {
    const html = renderToStaticMarkup(<PaperTradesView initialData={data} />);

    expect(html).toContain("模拟交易");
    expect(html).toContain("/stocks/002472");
    expect(html).toContain("进行中");
    expect(html).toContain("胜率");
    expect(html).toContain("手动平仓");
  });

  it("renders live price, floating P&L, and a manual close action only for an open trade", () => {
    const openData: PaperTradesData = {
      ...data,
      trades: [{
        ...data.trades[0],
        id: "paper-open",
        status: "open",
        exitPrice: null,
        exitTime: null,
        returnPercent: null,
      }],
      liveQuotesByTradeId: {
        "paper-open": {
          price: 36.19,
          marketTimestamp: "2026-07-29T11:00:00+08:00",
          source: "tencent",
        },
      },
    };

    const html = renderToStaticMarkup(<PaperTradesView initialData={openData} />);

    expect(html).toContain("36.19");
    expect(html).toContain("+1.23%");
    expect(html).toContain("手动平仓");
  });
});
