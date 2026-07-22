import type { StockSearchCandidate, StockSearchResponse } from "@/types/stock-search";

const TENCENT_BASE_URL = process.env.TENCENT_SERVICE_BASE_URL ?? "http://127.0.0.1:8001";
const SZSE_MAINBOARD_CODE = /^(000|001|002)\d{3}$/;

type SearchServiceOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

function isCandidate(value: unknown): value is StockSearchCandidate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.name === "string" &&
    candidate.exchange === "SZSE" &&
    candidate.source === "tencent_smartbox" &&
    SZSE_MAINBOARD_CODE.test(candidate.code)
  );
}

export class TencentStockSearchService {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ baseUrl = TENCENT_BASE_URL, fetchImpl = fetch }: SearchServiceOptions = {}) {
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
  }

  async search(query: string): Promise<StockSearchResponse> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return {
        success: false,
        error: { code: "EMPTY_QUERY", message: "搜索关键词不能为空" },
      };
    }

    try {
      const url = new URL("/search", this.baseUrl);
      url.searchParams.set("query", normalizedQuery);
      const response = await this.fetchImpl(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return unavailable();

      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object") return unavailable();
      const result = payload as { success?: unknown; data?: unknown };
      if (result.success !== true || !Array.isArray(result.data)) return unavailable();

      return {
        success: true,
        data: result.data.filter(isCandidate),
      };
    } catch {
      return unavailable();
    }
  }
}

function unavailable(): StockSearchResponse {
  return {
    success: false,
    error: { code: "UPSTREAM_UNAVAILABLE", message: "股票搜索服务暂不可用" },
  };
}
