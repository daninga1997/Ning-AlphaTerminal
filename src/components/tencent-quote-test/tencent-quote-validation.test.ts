import { describe, expect, it } from "vitest";
import { assessTencentQuoteResponse, type TencentQuoteApiResponse } from "./tencent-quote-validation";

const valid: TencentQuoteApiResponse = {
  success: true,
  data: [
    {
      code: "002472",
      name: "双环传动",
      exchange: "SZSE",
      price: 42.39,
      previousClose: 40,
      open: 41,
      high: 43,
      low: 40.5,
      change: 2.39,
      changePercent: 5.98,
      volume: 100_000,
      amount: 4_239_000,
      turnoverRate: 1.2,
      volumeRatio: 1.1,
      bidPrice: 42.39,
      askPrice: 42.4,
      marketTimestamp: "2026-07-16T10:00:00+08:00",
      receivedAt: "2026-07-16T10:00:01+08:00",
      status: "fresh",
      source: "tencent",
      isDemo: false,
    },
  ],
  meta: {
    source: "tencent",
    status: "fresh",
    marketTimestamp: "2026-07-16T10:00:00+08:00",
    receivedAt: "2026-07-16T10:00:01+08:00",
    isDemo: false,
    mode: "live",
  },
};

describe("assessTencentQuoteResponse", () => {
  it("accepts a non-demo Tencent quote with a positive finite price", () => {
    expect(assessTencentQuoteResponse(valid)).toEqual({ ok: true, reason: null });
  });

  it("rejects a mock response", () => {
    expect(assessTencentQuoteResponse({ ...valid, meta: { ...valid.meta, isDemo: true } })).toEqual({
      ok: false,
      reason: "演示数据不能作为腾讯链路验收结果",
    });
  });

  it("rejects a non-Tencent source", () => {
    expect(assessTencentQuoteResponse({ ...valid, meta: { ...valid.meta, source: "akshare" } })).toEqual({
      ok: false,
      reason: "数据来源不是腾讯",
    });
  });

  it("rejects an empty or invalid quote list", () => {
    expect(assessTencentQuoteResponse({ ...valid, data: [] })).toEqual({ ok: false, reason: "未返回有效报价" });
    expect(assessTencentQuoteResponse({ ...valid, data: [{ ...valid.data[0], price: Number.NaN }] })).toEqual({
      ok: false,
      reason: "报价价格无效",
    });
  });

  it("keeps safe API error messages", () => {
    expect(
      assessTencentQuoteResponse({ success: false, error: { code: "MARKET_DATA_ERROR", message: "行情数据服务异常" } }),
    ).toEqual({ ok: false, reason: "行情数据服务异常" });
  });
});
