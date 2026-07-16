import type { MarketDataFailure, MarketDataSuccess, StockQuote } from "@/types/market-data";

export type TencentQuoteApiResponse = MarketDataSuccess<StockQuote[]> | MarketDataFailure;

export type TencentQuoteVerification = {
  ok: boolean;
  reason: string | null;
};

export function assessTencentQuoteResponse(response: TencentQuoteApiResponse): TencentQuoteVerification {
  if (!response.success) return { ok: false, reason: response.error.message };
  if (response.meta.isDemo) return { ok: false, reason: "演示数据不能作为腾讯链路验收结果" };
  if (response.meta.source !== "tencent") return { ok: false, reason: "数据来源不是腾讯" };
  if (response.data.length === 0) return { ok: false, reason: "未返回有效报价" };
  if (response.data.some((quote) => quote.isDemo || quote.source !== "tencent")) {
    return { ok: false, reason: "报价来源不是腾讯真实数据" };
  }
  if (response.data.some((quote) => !Number.isFinite(quote.price) || quote.price <= 0)) {
    return { ok: false, reason: "报价价格无效" };
  }
  return { ok: true, reason: null };
}
