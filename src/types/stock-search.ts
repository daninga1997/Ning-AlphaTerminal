export type StockSearchCandidate = {
  code: string;
  name: string;
  exchange: "SZSE";
  source: "tencent_smartbox";
};

export type StockSearchResponse =
  | { success: true; data: StockSearchCandidate[] }
  | {
      success: false;
      error: {
        code: "EMPTY_QUERY" | "UPSTREAM_UNAVAILABLE";
        message: string;
      };
    };
